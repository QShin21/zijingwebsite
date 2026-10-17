import { APIError, type Payload } from "payload";
import type { User } from "../payload-types";
import { canReviewCommunityApplication, relationID } from "./rules";
import { workflowTransaction } from "./workflow-transactions";
import { applicationContactConsentRequiredMessage } from "./community-status";

export async function decideCommunityApplication(p: Payload, actor: User | null, id: number, decision: string, note: string, revision: unknown) {
  return workflowTransaction(p, actor, { communityApplicationDecision: true }, async req => {
    if (!canReviewCommunityApplication(req.user as User)) throw new APIError("无权审核社群申请", 403);
    const doc = await p.findByID({ collection: "community-applications", id, req, overrideAccess: false, depth: 0 });
    if (revision !== doc.updatedAt || doc.status !== "pending") throw new APIError("申请已更新或已处理，请刷新后核对", 409);
    if (!["approved", "returned", "rejected"].includes(decision)) throw new APIError("审核决定无效", 400);
    if (decision === "approved" && doc.contactConsent !== true)
      throw new APIError("由于入社流程规定，必须展示管理联系方式；请退回申请，由本人勾选同意后重新提交", 409);
    return p.update({ collection: "community-applications", id, req, overrideAccess: false,
      data: { status: decision as "approved" | "returned" | "rejected", reviewNote: note } });
  });
}

export async function editCommunityApplication(p: Payload, actor: User | null, id: number, revision: unknown, data: Record<string, unknown>) {
  return workflowTransaction(p, actor, { communityApplicationEdit: true }, async req => {
    const doc = await p.findByID({ collection: "community-applications", id, req, overrideAccess: false, depth: 0 });
    if (String(relationID(doc.applicant)) !== String(req.user!.id)) throw new APIError("只能修改本人的申请", 403);
    if (revision !== doc.updatedAt) throw new APIError("申请已更新，请刷新后核对", 409);
    if (data.status !== "withdrawn" && data.contactConsent !== true)
      throw new APIError(applicationContactConsentRequiredMessage, 400);
    return p.update({ collection: "community-applications", id, req, overrideAccess: false, data });
  });
}

export async function updateCommunityCard(p: Payload, actor: User | null, id: number, revision: unknown, data: { wechatQr?: string; contactConsent: boolean }) {
  return workflowTransaction(p, actor, { communityContactEdit: true }, async req => {
    const doc = await p.findByID({ collection: "community-applications", id, req, overrideAccess: false, depth: 0 });
    if (Number(relationID(doc.applicant)) !== req.user!.id || doc.status !== "approved") throw new APIError("只能更新本人已批准的名片", 403);
    if (revision !== doc.updatedAt) throw new APIError("资料已更新，请刷新后重试", 409);
    const user = req.user as User;
    const offices = (user.communityOffices ?? []).map(office => Number(relationID(office.game)) === Number(relationID(doc.game))
      ? { ...office, contactConsent: data.contactConsent, sourceApplication: doc.id } : office);
    await p.update({ collection: "users", id: user.id, req: { ...req, context: { ...req.context, system: true } }, overrideAccess: true, data: { communityOffices: offices } });
    return p.update({ collection: "community-applications", id, req, overrideAccess: false, data });
  });
}
