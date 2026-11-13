import Link from "next/link";
import type { TeamHonorRecord as HonorRecord } from "@/payload-types";
import type { HonorImage } from "@/lib/team-honor-model";
import { honorLabels, type HonorState } from "@/lib/team-honor-model";
import { translator, type Locale } from "@/lib/i18n/locale";
import { changeTeamHonorResultAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { teamHonorQuery } from "./TeamHonorNavigation";
import styles from "./team-pages/TeamPages.module.css";

const honorLabelsEn: Record<HonorState, string> = {
  draft: "Draft",
  pending: "Pending review",
  withdrawn: "Withdrawn",
  returned: "Returned for changes",
  rejected: "Rejected",
  approved: "Approved",
  hidden: "Hidden",
};

// Synchronous leaf: the calling server page passes its locale.
export function TeamHonorRecordCard({
  locale = "zh",
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
  locale?: Locale;
}) {
  const t = translator(locale);
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
            {t(`投稿人：${record.authorName}；修订 ${record.revision}`, `Submitted by ${record.authorName}; revision ${record.revision}`)}
          </p>
          <Heading>
            <Link href={detailHref}>{record.title}</Link>
          </Heading>
        </div>
        <span className={styles.status} data-state={record.state}>
          {t(honorLabels[record.state], honorLabelsEn[record.state as HonorState])}
        </span>
      </header>
      <dl className={styles.facts}>
        <div>
          <dt>{t("赛事", "Competition")}</dt>
          <dd>{record.competition || t("待补充", "To be added")}</dd>
        </div>
        <div>
          <dt>{t("奖项或名次", "Award or placing")}</dt>
          <dd>{record.placing || t("待补充", "To be added")}</dd>
        </div>
        <div>
          <dt>{t("赛事日期", "Competition date")}</dt>
          <dd>
            {record.date ? (
              <time dateTime={record.date.slice(0, 10)}>
                {record.date.slice(0, 10)}
              </time>
            ) : (
              t("待补充", "To be added")
            )}
          </dd>
        </div>
      </dl>
      {record.reviewNote && (
        <div className={styles.note}>
          <SectionHeading>{t("审核说明", "Review note")}</SectionHeading>
          <p className="preserve">{record.reviewNote}</p>
        </div>
      )}
      {owner && !editable && (
        <p className={styles.muted}>
          {t("当前有效入队关系已结束或队伍未开放。历史荣誉仍保留，新的修改请联系负责人。", "Your active team membership has ended or the team is closed. Past honors are kept; contact the team lead for new changes.")}
        </p>
      )}
      <details className={styles.disclosure} open={!compact}>
        <summary>
          {canAct ? t("查看材料与处理", "View materials and act") : t("查看投稿材料", "View submitted materials")}
          {images.length > 0
            ? t(`（${images.length} 份图片${record.videoURL ? "及视频" : ""}）`, ` (${images.length} image${images.length === 1 ? "" : "s"}${record.videoURL ? " and video" : ""})`)
            : record.videoURL
              ? t("（视频）", " (video)")
              : ""}
        </summary>
        <div className={canAct ? styles.reviewGrid : undefined}>
          <div className={styles.reviewContent}>
            <SectionHeading>{t("成果说明", "Achievement description")}</SectionHeading>
            <p className="preserve">
              {record.description || t("尚未填写成果说明。", "No description yet.")}
            </p>
            {(images.length > 0 || record.videoURL) && (
              <p className={styles.muted}>
                {t("投稿材料在审核前仅本人和有权限的审核者可见。", "Until review, materials are visible only to you and authorized reviewers.")}
              </p>
            )}
            {images.length > 0 && (
              <div className={styles.media}>
                {images.map((image, index) => (
                  <figure key={index}>
                    <img
                      src={image.source}
                      alt={image.caption || t("荣誉证据 " + (index + 1), "Honor evidence " + (index + 1))}
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
                aria-label={t("荣誉视频证据", "Honor video evidence")}
              />
            )}
          </div>
          {canAct && (
            <div className={styles.reviewAction}>
              <SectionHeading>
                {reviewer && record.state === "pending"
                  ? t("审核这项荣誉", "Review this honor")
                  : t("记录操作", "Record actions")}
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
                      {t("核对赛事、成绩与材料后处理。批准后更新同一队伍荣誉档案，并置顶到所属社群风采。", "Check the competition, result and materials before acting. Approval updates the team's honor archive and pins it to the community showcase.")}
                    </p>
                    <label>
                      {t("审核说明（退回或拒绝必填）", "Review note (required to return or reject)")}
                      <textarea name="note" maxLength={1000} rows={4} />
                    </label>
                    <div className={styles.actions}>
                      <SubmitButton name="action" value="approve">
                        {t("批准荣誉", "Approve honor")}
                      </SubmitButton>
                      <SubmitButton
                        className="button light"
                        name="action"
                        value="return"
                      >
                        {t("退回修改", "Return for changes")}
                      </SubmitButton>
                      <SubmitButton
                        className="button light"
                        name="action"
                        value="reject"
                      >
                        {t("拒绝荣誉", "Reject honor")}
                      </SubmitButton>
                    </div>
                  </>
                )}
                {owner && editable && record.state === "pending" && (
                  <>
                    <p>{t("撤回后可继续补充材料，再提交审核。", "After withdrawing, you can add materials and resubmit for review.")}</p>
                    <SubmitButton name="action" value="withdraw">
                      {t("撤回待审记录", "Withdraw pending submission")}
                    </SubmitButton>
                  </>
                )}
                {record.state === "approved" && (
                  <>
                    <p>{t("隐藏后，当前公开档案将不再展示这项荣誉。", "Once hidden, this honor no longer appears in the public archive.")}</p>
                    <label>
                      {t("隐藏说明", "Reason for hiding")}
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
                      {t("隐藏荣誉", "Hide honor")}
                    </SubmitButton>
                  </>
                )}
                {owner &&
                  editable &&
                  !["pending", "approved"].includes(record.state) && (
                    <Link href={detailHref + "#honor-editor"}>
                      {t("补充或修改投稿", "Add to or edit submission")}
                    </Link>
                  )}
                {reviewer &&
                  !["pending", "approved"].includes(record.state) && (
                    <p>{t("当前记录暂无可执行的审核操作。", "No review actions are available for this record.")}</p>
                  )}
              </ActionForm>
            </div>
          )}
        </div>
      </details>
      {compact && (
        <div className={styles.actions}>
          <Link href={detailHref}>
            {owner && editable ? t("打开记录 / 修改投稿", "Open record / edit submission") : t("打开完整记录", "Open full record")}
          </Link>
        </div>
      )}
    </article>
  );
}
