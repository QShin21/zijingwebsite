import Link from "next/link";
import type { TeamHonorRecord as HonorRecord } from "@/payload-types";
import type { HonorImage } from "@/lib/team-honor-model";
import { honorLabels } from "@/lib/team-honor-model";
import { changeTeamHonorAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";
import { teamHonorQuery } from "./TeamHonorNavigation";
import styles from "@/app/(frontend)/_club/ClubPages.module.css";

export function TeamHonorRecordCard({
  record,
  reviewer = false,
  owner = false,
  editable = false,
  returnQuery,
}: {
  record: HonorRecord;
  reviewer?: boolean;
  owner?: boolean;
  editable?: boolean;
  returnQuery?: string;
}) {
  const images = Array.isArray(record.images)
    ? (record.images as unknown as HonorImage[])
    : [];
  const navigation =
    returnQuery ??
    teamHonorQuery({ view: owner ? "mine" : reviewer ? "review" : "public" });
  return (
    <article className="panel showcase-card" data-honor-record={record.id}>
      <div className={styles.recordHead}>
        <span className={styles.status} data-state={record.state}>{honorLabels[record.state]}</span>
        <span className={styles.recordDate}>投稿人：{record.authorName} · 修订 {record.revision}</span>
      </div>
      <h3>
        <Link
          href={
            "/teams/honors/" + record.id + (navigation ? "?" + navigation : "")
          }
        >
          {record.title}
        </Link>
      </h3>
      <dl className={styles.recordMeta}>
        <div><dt>赛事</dt><dd>{record.competition || "待补充"}</dd></div>
        <div><dt>奖项或名次</dt><dd>{record.placing || "待补充"}</dd></div>
        <div><dt>赛事日期</dt><dd>{record.date?.slice(0, 10) || "待补充"}</dd></div>
      </dl>
      <p className="preserve">{record.description}</p>
      {(images.length > 0 || record.videoURL) && <p className="field-hint">审核材料 · {images.length} 份图片{record.videoURL ? "、1 份视频" : ""}。审核前仅本人和有权限的审核者可见。</p>}
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
          playsInline
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
      {record.reviewNote && <div className={styles.nextStep}><h3>审核说明</h3><p className="preserve">{record.reviewNote}</p></div>}
      {owner && !editable && (
        <p>
          当前有效入队关系已结束或队伍未开放。历史荣誉仍保留，新的修改请联系负责人。
        </p>
      )}
      {(reviewer || (owner && editable)) && (
        <form action={changeTeamHonorAction} className="member-form">
          <input type="hidden" name="returnQuery" value={navigation} />
          <input type="hidden" name="id" value={record.id} />
          <input type="hidden" name="revision" value={record.revision} />
          <input
            type="hidden"
            name="submittedVersion"
            value={record.submittedVersion || ""}
          />
          {reviewer && record.state === "pending" && (
            <>
              <p className="field-hint">请核实赛事、成绩与提交材料。批准后将更新同一队伍荣誉档案，并自动置顶到所属社群风采。</p>
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
