import Link from "next/link";
import type { TeamHonorRecord as HonorRecord } from "@/payload-types";
import type { HonorImage } from "@/lib/team-honor-model";
import { honorLabels } from "@/lib/team-honor-model";
import { changeTeamHonorAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";

export function TeamHonorRecordCard({
  record,
  reviewer = false,
  owner = false,
  editable = false,
}: {
  record: HonorRecord;
  reviewer?: boolean;
  owner?: boolean;
  editable?: boolean;
}) {
  const images = Array.isArray(record.images)
    ? (record.images as unknown as HonorImage[])
    : [];
  return (
    <article className="panel showcase-card" data-honor-record={record.id}>
      <p>
        <strong>{honorLabels[record.state]}</strong> · 投稿人：
        {record.authorName}
      </p>
      <h3>
        <Link href={"/teams/honors/" + record.id}>{record.title}</Link>
      </h3>
      <p>
        赛事：{record.competition || "待补充"} · 奖项：
        {record.placing || "待补充"} · 赛事日期：
        {record.date?.slice(0, 10) || "待补充"}
      </p>
      <p className="preserve">{record.description}</p>
      <div className="showcase-images">
        {images.map((image, index) => (
          <figure key={index}>
            <img
              src={image.source}
              alt={image.caption || "荣誉证据 " + (index + 1)}
              width={800}
              height={600}
              loading="lazy"
            />
            <figcaption>{image.caption}</figcaption>
          </figure>
        ))}
      </div>
      {record.videoURL && (
        <video
          controls
          preload="metadata"
          src={
            "/api/team-honor-evidence/" +
            record.id +
            "/video?revision=" +
            record.revision
          }
          aria-label="荣誉视频证据"
          style={{ maxWidth: "100%" }}
        />
      )}
      {record.reviewNote && <p>审核说明：{record.reviewNote}</p>}
      {owner && !editable && (
        <p>
          当前有效入队关系已结束或队伍未开放。历史荣誉仍保留，新的修改请联系负责人。
        </p>
      )}
      {(reviewer || (owner && editable)) && (
        <form action={changeTeamHonorAction} className="member-form">
          <input type="hidden" name="id" value={record.id} />
          <input type="hidden" name="revision" value={record.revision} />
          <input
            type="hidden"
            name="submittedVersion"
            value={record.submittedVersion || ""}
          />
          {reviewer && record.state === "pending" && (
            <>
              <label>
                审核说明（退回或拒绝必填）
                <textarea name="note" maxLength={1000} rows={2} />
              </label>
              <div className="reaction-bar">
                <SubmitButton name="action" value="approve">
                  批准荣誉
                </SubmitButton>
                <SubmitButton
                  className="button light"
                  name="action"
                  value="return"
                >
                  退回修改
                </SubmitButton>
                <SubmitButton
                  className="button light"
                  name="action"
                  value="reject"
                >
                  拒绝荣誉
                </SubmitButton>
              </div>
            </>
          )}
          {owner && editable && record.state === "pending" && (
            <SubmitButton name="action" value="withdraw">
              撤回待审记录
            </SubmitButton>
          )}
          {record.state === "approved" && (
            <>
              <label>
                隐藏说明
                <textarea name="note" maxLength={1000} required />
              </label>
              <SubmitButton className="button light" name="action" value="hide">
                隐藏荣誉
              </SubmitButton>
            </>
          )}
        </form>
      )}
    </article>
  );
}
