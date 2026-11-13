"use client";
import { unstable_rethrow } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { TeamHonorRecord } from "@/payload-types";
import type { HonorImage } from "@/lib/team-honor-model";
import type { HonorMembership } from "@/lib/team-honor-authority";
import {
  saveTeamHonorAction,
  type HonorFormState,
} from "@/app/(frontend)/teams/honors/actions";
import { localizeMessage } from "@/lib/i18n/messages";
import { useLocale, useT } from "./i18n/LocaleProvider";
import styles from "./team-pages/TeamPages.module.css";

export function TeamHonorEditor({
  record,
  memberships,
  returnQuery = "",
}: {
  record?: TeamHonorRecord;
  memberships: HonorMembership[];
  returnQuery?: string;
}) {
  const t = useT(),
    locale = useLocale();
  const imageFiles = useRef<File[]>([]),
    videoFile = useRef<File | null>(null);
  const [confirmedMissing, setConfirmedMissing] = useState(false);
  const [unconfirmedTeam, setUnconfirmedTeam] = useState("");
  const [state, action, pending] = useActionState(
    async (previous: HonorFormState, form: FormData) => {
      if (previous.unconfirmed && !confirmedMissing) return previous;
      form.delete("pictures");
      for (const file of imageFiles.current) form.append("pictures", file);
      if (videoFile.current) form.set("video", videoFile.current);
      const keptImages = images.filter(
        (_, index) => !checked["removeImage-" + index],
      ).length;
      if (keptImages + imageFiles.current.length > 6)
        return {
          error: t("证据图片最多 6 份。请减少新图片，或先勾选移除已有证据。", "At most 6 evidence images. Remove some new images, or mark existing evidence for removal first."),
        };
      if (
        imageFiles.current.some(
          (file) =>
            file.size > 2 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/webp"].includes(file.type),
        )
      )
        return {
          error:
            t("每份证据图片须为 2 MB 以内的 PNG、JPEG 或 WebP。附件和已填内容已保留。", "Each evidence image must be a PNG, JPEG or WebP under 2 MB. Your attachments and input are kept."),
        };
      if ((videoFile.current?.size || 0) > 10 * 1024 * 1024)
        return {
          error: t("视频证据须在 10 MB 以内，请重新选择视频。已填内容已保留。", "Video evidence must be under 10 MB. Choose another video; your input is kept."),
        };
      if (
        imageFiles.current.reduce(
          (total, file) => total + file.size,
          videoFile.current?.size || 0,
        ) >
        12 * 1024 * 1024
      )
        return {
          error:
            t("本次上传的图片与视频合计须在 12 MB 以内，请减少附件。已填内容已保留。", "Images and video in one upload must total under 12 MB. Remove some attachments; your input is kept."),
        };
      const markUnconfirmed = () => {
        setConfirmedMissing(false);
        const submittedTeam = record
          ? typeof record.team === "number"
            ? record.team
            : record.team.id
          : form.get("team");
        setUnconfirmedTeam(String(submittedTeam || ""));
      };
      try {
        const result = await saveTeamHonorAction(previous, form);
        if (result.unconfirmed) markUnconfirmed();
        return result;
      } catch (error) {
        unstable_rethrow(error);
        markUnconfirmed();
        return {
          error:
            t("连接中断，提交结果尚未确认。输入与附件已保留，请先查看本人荣誉记录，核对后再重试。", "The connection dropped and the result is unconfirmed. Your input and attachments are kept; check your honor records before retrying."),
          unconfirmed: true,
        };
      }
    },
    {} as HonorFormState,
  );
  const [pictures, setPictures] = useState<string[]>([]);
  const [picturePreviews, setPicturePreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState("");
  const picturesInput = useRef<HTMLInputElement>(null),
    videoInput = useRef<HTMLInputElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const urls = imageFiles.current.map((file, index) =>
      index < 6 &&
      file.size <= 2 * 1024 * 1024 &&
      ["image/png", "image/jpeg", "image/webp"].includes(file.type)
        ? URL.createObjectURL(file)
        : "",
    );
    setPicturePreviews(urls);
    return () =>
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
  }, [pictures]);
  useEffect(
    () => () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    },
    [videoPreview],
  );
  useEffect(() => {
    if (state.error) errorSummary.current?.focus();
  }, [state.error]);
  const [videoName, setVideoName] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const images = Array.isArray(record?.images)
    ? (record.images as unknown as HonorImage[])
    : [];
  const [fields, setFields] = useState<Record<string, string>>({
    team: String(memberships[0]?.team || ""),
    title: record?.title || "",
    competition: record?.competition || "",
    placing: record?.placing || "",
    date: record?.date?.slice(0, 10) || "",
    description: record?.description || "",
    ...Object.fromEntries(
      images.map((image, index) => ["caption-" + index, image.caption]),
    ),
  });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const fieldChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    // Snapshot DOM values during the event; React may run the updater after restoring a controlled input.
    const { name, value } = event.currentTarget;
    setFields((previous) => ({ ...previous, [name]: value }));
  };
  const ownRecords = new URLSearchParams(returnQuery);
  ownRecords.set("view", "mine");
  ownRecords.delete("page");
  if (state.unconfirmed && unconfirmedTeam)
    ownRecords.set("team", unconfirmedTeam);
  else if (!record && fields.team) ownRecords.set("team", fields.team);
  const retryLocked = Boolean(state.unconfirmed && !confirmedMissing);
  function removePicture(index: number) {
    imageFiles.current = imageFiles.current.filter((_, item) => item !== index);
    setFields((previous) => {
      const next = { ...previous };
      for (let item = index; item < pictures.length - 1; item++)
        next["newCaption-" + item] = previous["newCaption-" + (item + 1)] || "";
      delete next["newCaption-" + (pictures.length - 1)];
      return next;
    });
    setPictures(imageFiles.current.map((file) => file.name));
    if (picturesInput.current) picturesInput.current.value = "";
  }
  return (
    <section
      id="honor-editor"
      className={styles.editor}
      aria-labelledby="honor-editor-title"
    >
      <header className={styles.editorHeader}>
        <h2 id="honor-editor-title">
          {record ? t("修改荣誉记录", "Edit honor record") : t("提交队伍荣誉", "Submit a team honor")}
        </h2>
        <p>
          {record
            ? t("保存修改会撤下当前展示，重新批准后更新同一队伍档案。", "Saving changes withdraws the current display; the team archive updates after re-approval.")
            : t("写下赛事与成绩，上传获准公开的成果材料，由本社群管理员核验。", "Describe the competition and result, upload materials cleared for publication, and community admins will verify them.")}
        </p>
      </header>
      <form
        action={action}
        className="member-form"
        data-honor-editor
        aria-busy={!ready || pending}
      >
        {state.error && (
          <div ref={errorSummary} role="alert" tabIndex={-1}>
            <p>{localizeMessage(state.error, locale)}</p>
            <a href="#honor-basic-info">{t("核对填写内容", "Check your input")}</a>
          </div>
        )}
        {state.unconfirmed && (
          <div className={styles.note}>
            <p>
              {t("请先打开本人记录核对结果，再决定是否重新提交。已填内容与已选附件保留在当前页面。", "Open your records to check the result before resubmitting. Your input and selected attachments stay on this page.")}
            </p>
            <a
              className="text-link"
              href={"/teams/honors?" + ownRecords}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("查看本人荣誉记录", "View my honor records")}
            </a>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={confirmedMissing}
                onChange={(event) =>
                  setConfirmedMissing(event.currentTarget.checked)
                }
              />
              {t("已核对本人记录，确认本次未保存", "I checked my records and confirm this was not saved")}
            </label>
          </div>
        )}
        <input type="hidden" name="returnQuery" value={returnQuery} />
        <fieldset disabled={!ready || pending} aria-label={t("荣誉投稿表单", "Honor submission form")}>
          {record && (
            <>
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="revision" value={record.revision} />
            </>
          )}
          <div className={styles.editorBody}>
            <div className={styles.editorMain}>
              <section
                id="honor-basic-info"
                className={styles.formSection}
                aria-labelledby="honor-basic-title"
              >
                <h3 id="honor-basic-title">{t("赛事与成果", "Competition and result")}</h3>
                <p>
                  {t("草稿可稍后补充；提交审核前须填写完整赛事、成绩、日期和获奖说明。", "Drafts can be completed later; before submitting, fill in the competition, result, date and description.")}
                </p>
                {!record && (
                  <label>
                    {t("所属有效代表队", "Your active team")}
                    <select
                      name="team"
                      required
                      value={fields.team}
                      onChange={fieldChange}
                    >
                      <option value="" disabled>
                        {t("请选择代表队", "Choose a team")}
                      </option>
                      {memberships.map((membership) => (
                        <option key={membership.id} value={membership.team}>
                          {membership.teamInfo.gameTitle} ·{" "}
                          {membership.teamInfo.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  {t("荣誉标题", "Honor title")}
                  <input
                    name="title"
                    maxLength={120}
                    required
                    value={fields.title}
                    onChange={fieldChange}
                  />
                </label>
                <div className={styles.formColumns}>
                  <label>
                    {t("赛事名称", "Competition name")}
                    <input
                      name="competition"
                      maxLength={200}
                      value={fields.competition}
                      onChange={fieldChange}
                    />
                  </label>
                  <label>
                    {t("奖项或名次", "Award or placing")}
                    <input
                      name="placing"
                      maxLength={200}
                      value={fields.placing}
                      onChange={fieldChange}
                    />
                  </label>
                </div>
                <label>
                  {t("赛事日期", "Competition date")}
                  <input
                    type="date"
                    name="date"
                    value={fields.date}
                    onChange={fieldChange}
                  />
                </label>
                <label>
                  {t("获奖说明", "Description")}
                  <textarea
                    name="description"
                    maxLength={5000}
                    rows={5}
                    value={fields.description}
                    onChange={fieldChange}
                  />
                </label>
              </section>
              <section
                id="honor-evidence"
                className={styles.formSection}
                aria-labelledby="honor-evidence-title"
              >
                <h3 id="honor-evidence-title">{t("成果材料", "Evidence")}</h3>
                <p>
                  {t("提交时至少一份证据图片或本站 MP4。审核前仅本人和有权限的审核者可见；批准后证据随队伍档案展示，请上传获准公开的成果材料。", "Submit at least one evidence image or an MP4 uploaded here. Before review, only you and authorized reviewers can see it; after approval it is shown with the team archive, so upload only materials cleared for publication.")}
                </p>
                {images.length > 0 && (
                  <div className={styles.evidenceList}>
                    {images.map((image, index) => (
                      <div className={styles.evidenceItem} key={index}>
                        <img
                          src={image.source}
                          alt={image.caption || t("已有证据", "Existing evidence")}
                          width={240}
                          height={160}
                        />
                        <label>
                          {t(`已有证据 ${index + 1} 说明`, `Existing evidence ${index + 1} caption`)}
                          <input
                            name={"caption-" + index}
                            maxLength={200}
                            value={fields["caption-" + index] || ""}
                            onChange={fieldChange}
                          />
                        </label>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            name={"removeImage-" + index}
                            checked={checked["removeImage-" + index] || false}
                            onChange={(event) => {
                              const { name, checked } = event.currentTarget;
                              setChecked((previous) => ({
                                ...previous,
                                [name]: checked,
                              }));
                            }}
                          />
                          {t("移除这份证据", "Remove this evidence")}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <label>
                  {t("添加证据图片（每份 2 MB，最多 6 份）", "Add evidence images (2 MB each, up to 6)")}
                  <input
                    ref={picturesInput}
                    type="file"
                    name="pictures"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(event) => {
                      imageFiles.current = Array.from(event.target.files || []);
                      setPictures(imageFiles.current.map((file) => file.name));
                    }}
                  />
                </label>
                {pictures.length > 0 && (
                  <p className={styles.muted}>
                    {t(`已选择 ${pictures.length} 份新图片。补充每份材料的说明，方便审核与档案阅读。`, `${pictures.length} new image${pictures.length === 1 ? "" : "s"} selected. Add a caption to each to help review and readers.`)}
                  </p>
                )}
                {pictures.map((name, index) => (
                  <div className={styles.pendingFile} key={index}>
                    {picturePreviews[index] && (
                      <img
                        src={picturePreviews[index]}
                        alt={t(`待上传图片 ${index + 1} 预览`, `Preview of image ${index + 1} to upload`)}
                        width={400}
                        height={240}
                      />
                    )}
                    <label>
                      {t(`新证据 ${index + 1} 说明 · ${name}`, `New evidence ${index + 1} caption · ${name}`)}
                      <input
                        name={"newCaption-" + index}
                        maxLength={200}
                        required
                        value={fields["newCaption-" + index] || ""}
                        onChange={fieldChange}
                      />
                    </label>
                    <button
                      className="button light"
                      type="button"
                      onClick={() => removePicture(index)}
                    >
                      {t(`移除图片 ${index + 1}`, `Remove image ${index + 1}`)}
                    </button>
                  </div>
                ))}
                {record?.videoURL && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      name="removeVideo"
                      checked={checked.removeVideo || false}
                      onChange={(event) => {
                        const value = event.currentTarget.checked;
                        setChecked((previous) => ({
                          ...previous,
                          removeVideo: value,
                        }));
                      }}
                    />
                    {t("移除已有视频证据", "Remove existing video evidence")}
                  </label>
                )}
                <label>
                  {record?.videoURL
                    ? t("替换本站 MP4 证据（10 MB 以内）", "Replace MP4 evidence (under 10 MB)")
                    : t("添加本站 MP4 证据（10 MB 以内）", "Add MP4 evidence (under 10 MB)")}
                  <input
                    ref={videoInput}
                    type="file"
                    name="video"
                    accept="video/mp4,.mp4"
                    onChange={(event) => {
                      videoFile.current = event.target.files?.[0] || null;
                      setVideoName(videoFile.current?.name || "");
                      setVideoPreview(
                        videoFile.current &&
                          videoFile.current.size <= 10 * 1024 * 1024 &&
                          videoFile.current.type === "video/mp4"
                          ? URL.createObjectURL(videoFile.current)
                          : "",
                      );
                    }}
                  />
                </label>
                {videoName && (
                  <div>
                    <p>{t(`已选择视频：${videoName}`, `Selected video: ${videoName}`)}</p>
                    {videoPreview && (
                      <video
                        className={styles.video}
                        controls
                        playsInline
                        preload="metadata"
                        src={videoPreview}
                        aria-label={t("待上传视频预览", "Preview of video to upload")}
                      />
                    )}
                    <button
                      type="button"
                      className="button light"
                      onClick={() => {
                        videoFile.current = null;
                        setVideoName("");
                        setVideoPreview("");
                        if (videoInput.current) videoInput.current.value = "";
                      }}
                    >
                      {t("移除新视频", "Remove new video")}
                    </button>
                  </div>
                )}
                <p className="field-hint">
                  {t("本次附件合计最多 12 MB。外链视频不能作为荣誉审核证据。上传失败时保留已填内容，请核对反馈后重试。", "Attachments total at most 12 MB. External video links are not accepted as evidence. If an upload fails your input is kept; check the message and retry.")}
                </p>
              </section>
              <section
                className={styles.commit}
                aria-labelledby="honor-submit-title"
              >
                <h3 id="honor-submit-title">{t("核对并提交", "Review and submit")}</h3>
                <p className={styles.muted}>
                  {t("保存草稿可稍后继续。提交审核后，处理意见会显示在本人荣誉记录中。", "Save a draft to continue later. After you submit, review notes appear in your honor records.")}
                </p>
                <div className={styles.actions}>
                  <button
                    className="button light"
                    name="action"
                    value="save"
                    disabled={pending || retryLocked}
                  >
                    {t("保存草稿", "Save draft")}
                  </button>
                  <button
                    className="button"
                    name="action"
                    value="submit"
                    disabled={pending || retryLocked}
                  >
                    {pending ? t("正在保存…", "Saving…") : t("提交审核", "Submit for review")}
                  </button>
                </div>
              </section>
            </div>
            <div className={styles.editorGuide}>
              <h3>{t("一份完整的荣誉记录", "A complete honor record")}</h3>
              <ol>
                <li>{t("写清赛事、成绩与日期。", "State the competition, result and date.")}</li>
                <li>{t("上传获准公开的成果材料，并补充说明。", "Upload materials cleared for publication, with captions.")}</li>
                <li>{t("核对内容，保存草稿或提交审核。", "Check everything, then save a draft or submit.")}</li>
              </ol>
              <p>{t("本人兼任管理员也须由他人审核。", "Admins submitting their own honors still need another reviewer.")}</p>
              {record && (
                <p>
                  {t("本次修改保存后，当前公开展示会撤下，待重新批准后更新档案。", "Once saved, the current public display is withdrawn until re-approval updates the archive.")}
                </p>
              )}
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
