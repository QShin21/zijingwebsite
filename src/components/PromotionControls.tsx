import styles from "./community-pages/CommunityPages.module.css";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { promotionAction } from "@/app/(frontend)/community/promotions/actions";
import type { ContentPromotion } from "@/payload-types";
import type { PromotionSource } from "@/lib/promotion-model";

export function PromotionControls({
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
          申请正在等待审核。处理结果会保存在原记录中。
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
                撤回申请
              </SubmitButton>
            </ActionForm>
          )}
        {reviewer && (
          <ActionForm action={promotionAction} className="member-form">
            {fields}
            {!canApprove && (
              <p role="status">
                原内容版本已变化或已不可公开，请退回处理后重新申请。
              </p>
            )}
            <label>
              审核意见（退回或拒绝必填）
              <textarea name="reason" rows={3} maxLength={1000} />
            </label>
            <div className="reaction-bar">
              <SubmitButton
                name="action"
                value="approve"
                disabled={!canApprove}
              >
                通过升推
              </SubmitButton>
              <SubmitButton
                name="action"
                value="return"
                className="button light"
              >
                退回修改
              </SubmitButton>
              <SubmitButton
                name="action"
                value="reject"
                className="button light"
              >
                拒绝升推
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </>
    );
  if (current?.status === "approved")
    return reviewer ? (
      <details className={styles.disclosure} open>
        <summary>调整展示范围</summary>
        <p>降级后保留社群展示与原报名记录。</p>
        <ActionForm action={promotionAction} className="member-form">
          {fields}
          <label>
            降级理由
            <textarea name="reason" required maxLength={1000} rows={2} />
          </label>
          <SubmitButton name="action" value="demote" className="button light">
            降为社群展示
          </SubmitButton>
        </ActionForm>
      </details>
    ) : (
      <p className="field-hint">已通过升推，当前展示状态可在下方记录中查看。</p>
    );
  return (
    <>
      {manager && (
        <ActionForm action={promotionAction} className="member-form">
          {fields}
          <label>
            升推理由
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
            {current ? "重新申请升推" : "申请升推"}
          </SubmitButton>
        </ActionForm>
      )}
      {reviewer && (
        <details className={styles.disclosure} open>
          <summary>直接升为社团展示</summary>
          <p>你有权直接提升当前内容，处理理由会留在记录中。</p>
          <ActionForm action={promotionAction} className="member-form">
            {fields}
            <label>
              主动升推理由
              <textarea name="reason" required maxLength={1000} rows={2} />
            </label>
            <SubmitButton
              name="action"
              value="promote"
              className="button light"
            >
              主动升推
            </SubmitButton>
          </ActionForm>
        </details>
      )}
    </>
  );
}
