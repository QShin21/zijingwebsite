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
import styles from "@/app/(frontend)/_club/ClubPages.module.css";

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
  return (
    <form
      action={action}
      className="member-form panel"
      data-honor-editor
      aria-busy={!ready || pending}
    >
      <h2>{record ? "修改荣誉记录" : "提交队伍荣誉"}</h2>
      <p>
        {record
          ? "保存修改会撤下当前展示，重新批准后更新同一队伍档案。"
          : "记录比赛与成绩，提交材料后由本社群管理员核验。"}
        本人兼任管理员也须由他人审核。
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      {state.unconfirmed && (
        <p>
          <a
            className="text-link"
            href={"/teams/honors?" + ownRecords}
            target="_blank"
            rel="noopener noreferrer"
          >
            查看本人荣誉记录
          </a>
        </p>
      )}
      {state.unconfirmed && (
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
      )}
      <input type="hidden" name="returnQuery" value={returnQuery} />
      <fieldset disabled={!ready || pending} aria-label="荣誉投稿表单">
        {record ? (
          <>
            <input type="hidden" name="id" value={record.id} />
            <input type="hidden" name="revision" value={record.revision} />
          </>
        ) : (
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
                  {membership.teamInfo.gameTitle} · {membership.teamInfo.title}
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
        <fieldset className={styles.evidenceSection}>
          <legend>审核证据</legend>
          <p>
            提交时至少一份证据图片或本站
            MP4。审核前仅本人和有权限的审核者可见；批准后证据随队伍档案展示，请上传获准公开的成果材料。
          </p>
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
          <label>
            添加证据图片（每份 2 MB，最多 6 份）
            <input
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
            <p className="field-hint">
              已选择 {pictures.length}{" "}
              份新图片。请逐份补充说明，方便审核与档案阅读。
            </p>
          )}
          {pictures.map((name, index) => (
            <label key={index}>
              新证据 {index + 1} 说明 · {name}
              <input
                name={"newCaption-" + index}
                maxLength={200}
                required
                value={fields["newCaption-" + index] || ""}
                onChange={fieldChange}
              />
            </label>
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
            {record?.videoURL ? "替换" : "添加"}本站 MP4 证据（10 MB 以内）
            <input
              type="file"
              name="video"
              accept="video/mp4,.mp4"
              onChange={(event) => {
                videoFile.current = event.target.files?.[0] || null;
                setVideoName(videoFile.current?.name || "");
              }}
            />
          </label>
          {videoName && <p>已选择视频：{videoName}</p>}
          <p className="field-hint">
            一次提交的附件总共最多 12
            MB。外链视频不能作为荣誉审核证据。上传失败时保留已填内容，请核对反馈后重试。
          </p>
        </fieldset>
        <div className="reaction-bar">
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
      </fieldset>
    </form>
  );
}
