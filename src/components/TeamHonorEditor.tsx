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
          error: "证据图片最多 6 份。请减少新图片，或先勾选移除已有证据。",
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
            "每份证据图片须为 2 MB 以内的 PNG、JPEG 或 WebP。附件和已填内容已保留。",
        };
      if ((videoFile.current?.size || 0) > 10 * 1024 * 1024)
        return {
          error: "视频证据须在 10 MB 以内，请重新选择视频。已填内容已保留。",
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
            "本次上传的图片与视频合计须在 12 MB 以内，请减少附件。已填内容已保留。",
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
            "连接中断，提交结果尚未确认。输入与附件已保留，请先查看本人荣誉记录，核对后再重试。",
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
          {record ? "修改荣誉记录" : "提交队伍荣誉"}
        </h2>
        <p>
          {record
            ? "保存修改会撤下当前展示，重新批准后更新同一队伍档案。"
            : "写下赛事与成绩，上传获准公开的成果材料，由本社群管理员核验。"}
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
            <p>{state.error}</p>
            <a href="#honor-basic-info">核对填写内容</a>
          </div>
        )}
        {state.unconfirmed && (
          <div className={styles.note}>
            <p>
              请先打开本人记录核对结果，再决定是否重新提交。已填内容与已选附件保留在当前页面。
            </p>
            <a
              className="text-link"
              href={"/teams/honors?" + ownRecords}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看本人荣誉记录
            </a>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={confirmedMissing}
                onChange={(event) =>
                  setConfirmedMissing(event.currentTarget.checked)
                }
              />
              已核对本人记录，确认本次未保存
            </label>
          </div>
        )}
        <input type="hidden" name="returnQuery" value={returnQuery} />
        <fieldset disabled={!ready || pending} aria-label="荣誉投稿表单">
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
                <h3 id="honor-basic-title">赛事与成果</h3>
                <p>
                  草稿可稍后补充；提交审核前须填写完整赛事、成绩、日期和获奖说明。
                </p>
                {!record && (
                  <label>
                    所属有效代表队
                    <select
                      name="team"
                      required
                      value={fields.team}
                      onChange={fieldChange}
                    >
                      <option value="" disabled>
                        请选择代表队
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
                  荣誉标题
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
                    赛事名称
                    <input
                      name="competition"
                      maxLength={200}
                      value={fields.competition}
                      onChange={fieldChange}
                    />
                  </label>
                  <label>
                    奖项或名次
                    <input
                      name="placing"
                      maxLength={200}
                      value={fields.placing}
                      onChange={fieldChange}
                    />
                  </label>
                </div>
                <label>
                  赛事日期
                  <input
                    type="date"
                    name="date"
                    value={fields.date}
                    onChange={fieldChange}
                  />
                </label>
                <label>
                  获奖说明
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
                <h3 id="honor-evidence-title">成果材料</h3>
                <p>
                  提交时至少一份证据图片或本站
                  MP4。审核前仅本人和有权限的审核者可见；批准后证据随队伍档案展示，请上传获准公开的成果材料。
                </p>
                {images.length > 0 && (
                  <div className={styles.evidenceList}>
                    {images.map((image, index) => (
                      <div className={styles.evidenceItem} key={index}>
                        <img
                          src={image.source}
                          alt={image.caption || "已有证据"}
                          width={240}
                          height={160}
                        />
                        <label>
                          已有证据 {index + 1} 说明
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
                          移除这份证据
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <label>
                  添加证据图片（每份 2 MB，最多 6 份）
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
                    已选择 {pictures.length}{" "}
                    份新图片。补充每份材料的说明，方便审核与档案阅读。
                  </p>
                )}
                {pictures.map((name, index) => (
                  <div className={styles.pendingFile} key={index}>
                    {picturePreviews[index] && (
                      <img
                        src={picturePreviews[index]}
                        alt={`待上传图片 ${index + 1} 预览`}
                        width={400}
                        height={240}
                      />
                    )}
                    <label>
                      新证据 {index + 1} 说明 · {name}
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
                      移除图片 {index + 1}
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
                    移除已有视频证据
                  </label>
                )}
                <label>
                  {record?.videoURL ? "替换" : "添加"}本站 MP4 证据（10 MB
                  以内）
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
                    <p>已选择视频：{videoName}</p>
                    {videoPreview && (
                      <video
                        className={styles.video}
                        controls
                        playsInline
                        preload="metadata"
                        src={videoPreview}
                        aria-label="待上传视频预览"
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
                      移除新视频
                    </button>
                  </div>
                )}
                <p className="field-hint">
                  本次附件合计最多 12
                  MB。外链视频不能作为荣誉审核证据。上传失败时保留已填内容，请核对反馈后重试。
                </p>
              </section>
              <section
                className={styles.commit}
                aria-labelledby="honor-submit-title"
              >
                <h3 id="honor-submit-title">核对并提交</h3>
                <p className={styles.muted}>
                  保存草稿可稍后继续。提交审核后，处理意见会显示在本人荣誉记录中。
                </p>
                <div className={styles.actions}>
                  <button
                    className="button light"
                    name="action"
                    value="save"
                    disabled={pending || retryLocked}
                  >
                    保存草稿
                  </button>
                  <button
                    className="button"
                    name="action"
                    value="submit"
                    disabled={pending || retryLocked}
                  >
                    {pending ? "正在保存…" : "提交审核"}
                  </button>
                </div>
              </section>
            </div>
            <div className={styles.editorGuide}>
              <h3>一份完整的荣誉记录</h3>
              <ol>
                <li>写清赛事、成绩与日期。</li>
                <li>上传获准公开的成果材料，并补充说明。</li>
                <li>核对内容，保存草稿或提交审核。</li>
              </ol>
              <p>本人兼任管理员也须由他人审核。</p>
              {record && (
                <p>
                  本次修改保存后，当前公开展示会撤下，待重新批准后更新档案。
                </p>
              )}
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
