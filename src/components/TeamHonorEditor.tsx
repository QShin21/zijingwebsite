"use client";
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

export function TeamHonorEditor({
  record,
  memberships,
}: {
  record?: TeamHonorRecord;
  memberships: HonorMembership[];
}) {
  const imageFiles = useRef<File[]>([]),
    videoFile = useRef<File | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: HonorFormState, form: FormData) => {
      form.delete("pictures");
      for (const file of imageFiles.current) form.append("pictures", file);
      if (videoFile.current) form.set("video", videoFile.current);
      return saveTeamHonorAction(previous, form);
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
  return (
    <form
      action={action}
      className="member-form panel"
      data-honor-editor
      aria-busy={!ready || pending}
    >
      <h2>{record ? "修改荣誉记录" : "提交队伍荣誉"}</h2>
      <p>
        保存修改会撤下当前展示。提交后由对应社群管理员审核；本人兼任管理员也须由他人审核。
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      <fieldset
        disabled={!ready || pending}
        aria-label="荣誉投稿表单"
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minWidth: 0,
          display: "contents",
        }}
      >
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
        <fieldset>
          <legend>审核证据</legend>
          <p>
            提交时至少一份证据图片或本站
            MP4。批准后证据在队伍档案展示，请上传获准公开的成果材料。
          </p>
          {images.map((image, index) => (
            <div key={index}>
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
          <p>一次提交的附件总共最多 12 MB。外链视频不能作为荣誉审核证据。</p>
        </fieldset>
        <div className="reaction-bar">
          <button
            className="button light"
            name="action"
            value="save"
            disabled={pending}
          >
            保存草稿
          </button>
          <button
            className="button"
            name="action"
            value="submit"
            disabled={pending}
          >
            {pending ? "正在保存…" : "提交审核"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
