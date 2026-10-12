import { SubmitButton } from "./SubmitButton";
import { promotionAction } from "@/app/(frontend)/community/promotions/actions";
import type { ContentPromotion } from "@/payload-types";
import type { PromotionSource } from "@/lib/promotion-model";

export function PromotionControls({ collection, id, version, current, manager, reviewer, actor, canApprove = true }: {
  collection: PromotionSource; id: number; version: string; current?: ContentPromotion; manager: boolean; reviewer: boolean; actor: number; canApprove?: boolean;
}) {
  const fields = <>
    <input type="hidden" name="sourceCollection" value={collection} /><input type="hidden" name="sourceID" value={id} />
    <input type="hidden" name="revision" value={current?.updatedAt ?? ""} /><input type="hidden" name="sourceVersion" value={version} />
  </>;
  if (current?.status === "pending") return <>
    {manager && Number(typeof current.requestedBy === "object" ? current.requestedBy?.id : current.requestedBy) === actor &&
      <form action={promotionAction}>{fields}<SubmitButton name="action" value="withdraw" className="button light">撤回申请</SubmitButton></form>}
    {reviewer && <form action={promotionAction} className="member-form">{fields}
      <label>审核意见（退回或拒绝必填）<textarea name="reason" rows={3} maxLength={1000} /></label>
      <div className="reaction-bar"><SubmitButton name="action" value="approve" disabled={!canApprove}>通过升推</SubmitButton>
        <SubmitButton name="action" value="return" className="button light">退回修改</SubmitButton>
        <SubmitButton name="action" value="reject" className="button light">拒绝升推</SubmitButton></div>
    </form>}
  </>;
  if (current?.status === "approved") return reviewer ? <form action={promotionAction} className="member-form">{fields}
    <label>降级理由<textarea name="reason" required maxLength={1000} rows={2} /></label>
    <SubmitButton name="action" value="demote" className="button light">降为社群展示</SubmitButton>
  </form> : null;
  return <>
    {manager && <form action={promotionAction} className="member-form">{fields}
      <label>升推理由<textarea name="reason" required minLength={5} maxLength={1000} rows={3} defaultValue={current?.reason ?? ""} /></label>
      <SubmitButton name="action" value="submit">{current ? "重新申请升推" : "申请升推"}</SubmitButton>
    </form>}
    {reviewer && <form action={promotionAction} className="member-form">{fields}
      <label>主动升推理由<textarea name="reason" required maxLength={1000} rows={2} /></label>
      <SubmitButton name="action" value="promote" className="button light">主动升推</SubmitButton>
    </form>}
  </>;
}
