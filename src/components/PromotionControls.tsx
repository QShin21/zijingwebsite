import styles from "./community-pages/CommunityPages.module.css";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { promotionAction } from "@/app/(frontend)/community/promotions/actions";
import type { ContentPromotion } from "@/payload-types";
import type { PromotionSource } from "@/lib/promotion-model";
import { getT } from "@/lib/i18n/server";

export async function PromotionControls({
  collection,
  id,
  version,
  current,
  manager,
  reviewer,
  actor,
  canApprove = true,
  returnQuery = "",
}: {
  collection: PromotionSource;
  id: number;
  version: string;
  current?: ContentPromotion;
  manager: boolean;
  reviewer: boolean;
  actor: number;
  canApprove?: boolean;
  returnQuery?: string;
}) {
  const { t } = await getT();
  const fields = (
    <>
      <input type="hidden" name="sourceCollection" value={collection} />
      <input type="hidden" name="sourceID" value={id} />
      <input type="hidden" name="revision" value={current?.updatedAt ?? ""} />
      <input type="hidden" name="sourceVersion" value={version} />
      <input type="hidden" name="returnQuery" value={returnQuery} />
    </>
  );
  if (current?.status === "pending")
    return (
      <>
        <p className="field-hint">
          {t("申请正在等待审核。处理结果会保存在原记录中。", "The request is awaiting review. The result is saved in the original record.")}
        </p>
        {manager &&
          Number(
            typeof current.requestedBy === "object"
              ? current.requestedBy?.id
              : current.requestedBy,
          ) === actor && (
            <ActionForm action={promotionAction}>
              {fields}
              <SubmitButton
                name="action"
                value="withdraw"
                className="button light"
              >
                {t("撤回申请", "Withdraw request")}
              </SubmitButton>
            </ActionForm>
          )}
        {reviewer && (
          <ActionForm action={promotionAction} className="member-form">
            {fields}
            {!canApprove && (
              <p role="status">
                {t("原内容版本已变化或已不可公开，请退回处理后重新申请。", "The original content changed or is no longer public. Return it so it can be resubmitted.")}
              </p>
            )}
            <label>
              {t("审核意见（退回或拒绝必填）", "Review note (required to return or reject)")}
              <textarea name="reason" rows={3} maxLength={1000} />
            </label>
            <div className="reaction-bar">
              <SubmitButton
                name="action"
                value="approve"
                disabled={!canApprove}
              >
                {t("通过升推", "Approve promotion")}
              </SubmitButton>
              <SubmitButton
                name="action"
                value="return"
                className="button light"
              >
                {t("退回修改", "Return for changes")}
              </SubmitButton>
              <SubmitButton
                name="action"
                value="reject"
                className="button light"
              >
                {t("拒绝升推", "Reject promotion")}
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </>
    );
  if (current?.status === "approved")
    return reviewer ? (
      <details className={styles.disclosure} open>
        <summary>{t("调整展示范围", "Adjust display scope")}</summary>
        <p>{t("降级后保留社群展示与原报名记录。", "Demoting keeps the community display and existing sign-ups.")}</p>
        <ActionForm action={promotionAction} className="member-form">
          {fields}
          <label>
            {t("降级理由", "Reason for demotion")}
            <textarea name="reason" required maxLength={1000} rows={2} />
          </label>
          <SubmitButton name="action" value="demote" className="button light">
            {t("降为社群展示", "Demote to community display")}
          </SubmitButton>
        </ActionForm>
      </details>
    ) : (
      <p className="field-hint">{t("已通过升推，当前展示状态可在下方记录中查看。", "Promoted. The current display status is in the records below.")}</p>
    );
  return (
    <>
      {manager && (
        <ActionForm action={promotionAction} className="member-form">
          {fields}
          <label>
            {t("升推理由", "Reason for promotion")}
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              defaultValue={current?.reason ?? ""}
            />
          </label>
          <SubmitButton name="action" value="submit">
            {current ? t("重新申请升推", "Request promotion again") : t("申请升推", "Request promotion")}
          </SubmitButton>
        </ActionForm>
      )}
      {reviewer && (
        <details className={styles.disclosure} open>
          <summary>{t("直接升为社团展示", "Promote to the club front page")}</summary>
          <p>{t("你有权直接提升当前内容，处理理由会留在记录中。", "You can promote this content directly; your reason is kept in the record.")}</p>
          <ActionForm action={promotionAction} className="member-form">
            {fields}
            <label>
              {t("主动升推理由", "Reason for direct promotion")}
              <textarea name="reason" required maxLength={1000} rows={2} />
            </label>
            <SubmitButton
              name="action"
              value="promote"
              className="button light"
            >
              {t("主动升推", "Promote directly")}
            </SubmitButton>
          </ActionForm>
        </details>
      )}
    </>
  );
}
