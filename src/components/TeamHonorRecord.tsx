import Link from "next/link";
import type { TeamHonorRecord as HonorRecord } from "@/payload-types";
import type { HonorImage } from "@/lib/team-honor-model";
import { honorLabels } from "@/lib/team-honor-model";
import { changeTeamHonorResultAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { teamHonorQuery } from "./TeamHonorNavigation";
import styles from "./team-pages/TeamPages.module.css";

export function TeamHonorRecordCard({
  record,
  reviewer = false,
  owner = false,
  editable = false,
  returnQuery,
  headingLevel: Heading = "h3",
  compact = false,
}: {
  record: HonorRecord;
  reviewer?: boolean;
  owner?: boolean;
  editable?: boolean;
  returnQuery?: string;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
}) {
  const images = Array.isArray(record.images)
    ? (record.images as unknown as HonorImage[])
    : [];
  const navigation =
    returnQuery ??
    teamHonorQuery({ view: owner ? "mine" : reviewer ? "review" : "public" });
  const detailHref =
    "/teams/honors/" + record.id + (navigation ? "?" + navigation : "");
  const canAct = reviewer || (owner && editable);
  const SectionHeading = Heading === "h2" ? "h3" : "h4";
  return (
    <article className={styles.honorRecord} data-honor-record={record.id}>
      <header className={styles.honorTitle}>
        <div>
          <p className={styles.recordDate}>
            投稿人：{record.authorName}；修订 {record.revision}
          </p>
          <Heading>
            <Link href={detailHref}>{record.title}</Link>
          </Heading>
        </div>
        <span className={styles.status} data-state={record.state}>
          {honorLabels[record.state]}
        </span>
      </header>
      <dl className={styles.facts}>
        <div>
          <dt>赛事</dt>
          <dd>{record.competition || "待补充"}</dd>
        </div>
        <div>
          <dt>奖项或名次</dt>
          <dd>{record.placing || "待补充"}</dd>
        </div>
        <div>
          <dt>赛事日期</dt>
          <dd>
            {record.date ? (
              <time dateTime={record.date.slice(0, 10)}>
                {record.date.slice(0, 10)}
              </time>
            ) : (
              "待补充"
            )}
          </dd>
        </div>
      </dl>
      {record.reviewNote && (
        <div className={styles.note}>
          <SectionHeading>审核说明</SectionHeading>
          <p className="preserve">{record.reviewNote}</p>
        </div>
      )}
      {owner && !editable && (
        <p className={styles.muted}>
          当前有效入队关系已结束或队伍未开放。历史荣誉仍保留，新的修改请联系负责人。
        </p>
      )}
      <details className={styles.disclosure} open={!compact}>
        <summary>
          {canAct ? "查看材料与处理" : "查看投稿材料"}
          {images.length > 0
            ? `（${images.length} 份图片${record.videoURL ? "及视频" : ""}）`
            : record.videoURL
              ? "（视频）"
              : ""}
        </summary>
        <div className={canAct ? styles.reviewGrid : undefined}>
          <div className={styles.reviewContent}>
            <SectionHeading>成果说明</SectionHeading>
            <p className="preserve">
              {record.description || "尚未填写成果说明。"}
            </p>
            {(images.length > 0 || record.videoURL) && (
              <p className={styles.muted}>
                投稿材料在审核前仅本人和有权限的审核者可见。
              </p>
            )}
            {images.length > 0 && (
              <div className={styles.media}>
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
            )}
            {record.videoURL && (
              <video
                className={styles.video}
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
              />
            )}
          </div>
          {canAct && (
            <div className={styles.reviewAction}>
              <SectionHeading>
                {reviewer && record.state === "pending"
                  ? "审核这项荣誉"
                  : "记录操作"}
              </SectionHeading>
              <ActionForm
                action={changeTeamHonorResultAction}
                className="member-form"
              >
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
                    <p>
                      核对赛事、成绩与材料后处理。批准后更新同一队伍荣誉档案，并置顶到所属社群风采。
                    </p>
                    <label>
                      审核说明（退回或拒绝必填）
                      <textarea name="note" maxLength={1000} rows={4} />
                    </label>
                    <div className={styles.actions}>
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
                  <>
                    <p>撤回后可继续补充材料，再提交审核。</p>
                    <SubmitButton name="action" value="withdraw">
                      撤回待审记录
                    </SubmitButton>
                  </>
                )}
                {record.state === "approved" && (
                  <>
                    <p>隐藏后，当前公开档案将不再展示这项荣誉。</p>
                    <label>
                      隐藏说明
                      <textarea
                        name="note"
                        maxLength={1000}
                        required
                        rows={3}
                      />
                    </label>
                    <SubmitButton
                      className="button light"
                      name="action"
                      value="hide"
                    >
                      隐藏荣誉
                    </SubmitButton>
                  </>
                )}
                {owner &&
                  editable &&
                  !["pending", "approved"].includes(record.state) && (
                    <Link href={detailHref + "#honor-editor"}>
                      补充或修改投稿
                    </Link>
                  )}
                {reviewer &&
                  !["pending", "approved"].includes(record.state) && (
                    <p>当前记录暂无可执行的审核操作。</p>
                  )}
              </ActionForm>
            </div>
          )}
        </div>
      </details>
      {compact && (
        <div className={styles.actions}>
          <Link href={detailHref}>
            {owner && editable ? "打开记录 / 修改投稿" : "打开完整记录"}
          </Link>
        </div>
      )}
    </article>
  );
}
