import { APIError, type Payload } from "payload";
import type { User } from "../payload-types";
import { canHandleCommunityJoins, canReviewCommunityApplication, communityIDs, relationID } from "./rules";
import { workflowTransaction, databaseCode, uniqueFieldError } from "./workflow-transactions";
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

export async function changeCommunityJoin(p: Payload, actor: User | null, gameID: number, action: string, options: { contact?: number; id?: number; revision?: unknown; note?: string } = {}) {
  try {
    return await workflowTransaction(p, actor, { communityJoinWrite: true }, async req => {
      const user = req.user as User;
      const game = await p.findByID({ collection: "games", id: gameID, req: { ...req, user: null }, user: null, overrideAccess: false, draft: false, depth: 0 }).catch(() => null);
      if (!game || game._status !== "published") throw new APIError("该社群尚未开放", 404);
      const found = options.id ? await p.findByID({ collection: "community-joins", id: options.id, req, overrideAccess: false, depth: 0 })
        : (await p.find({ collection: "community-joins", req, overrideAccess: false, depth: 0, limit: 1,
          where: { and: [{ member: { equals: user.id } }, { game: { equals: gameID } }] } })).docs[0];
      if (found && Number(relationID(found.game)) !== gameID) throw new APIError("记录与社群不匹配", 403);
      if (action === "request") {
        if (found && Number(relationID(found.member)) !== user.id) throw new APIError("只能记录本人的意向", 403);
        if (found && found.status !== "withdrawn") return found;
        const contact = await p.findByID({ collection: "users", id: options.contact || 0, req, overrideAccess: true, depth: 0 }).catch(() => null);
        if (!contact || !communityIDs(contact, "contactConsent").includes(String(gameID))) throw new APIError("此管理员名片已不可用，请重新选择", 409);
        const cards = await p.find({ collection: "community-applications", req: { ...req, user: null }, user: null, overrideAccess: false,
          context: { publicCommunityContacts: gameID }, depth: 0, limit: 1,
          where: { applicant: { equals: contact.id } }, select: { wechatQr: true } });
        if (!cards.docs[0]?.wechatQr) throw new APIError("管理员尚未提供有效名片，请稍后联系负责人", 409);
        const data = { status: "requested" as const, contact: contact.id, note: null, confirmedBy: null, confirmedAt: null };
        return found ? p.update({ collection: "community-joins", id: found.id, req, overrideAccess: false, data })
          : p.create({ collection: "community-joins", req, overrideAccess: false, data: { ...data, game: gameID, member: user.id, memberName: user.name, dedupeKey: `${gameID}:${user.id}` } });
      }
      if (!found) throw new APIError("请先记录加入意向", 404);
      if (options.revision !== found.updatedAt) throw new APIError("进度已更新，请刷新后核对", 409);
      const owner = Number(relationID(found.member)) === user.id;
      if (["reportFriend", "withdraw"].includes(action)) {
        if (!owner) throw new APIError("只能更新本人进群意向", 403);
        if (action === "reportFriend" && !["requested", "friendReported"].includes(found.status)) throw new APIError("此进度不能重复报告好友申请", 409);
        if (action === "withdraw" && ["joined", "withdrawn"].includes(found.status)) throw new APIError("此进度不能撤回；退出微信群请联系管理员", 409);
        return p.update({ collection: "community-joins", id: found.id, req, overrideAccess: false,
          data: { status: action === "reportFriend" ? "friendReported" : "withdrawn" } });
      }
      if (!canHandleCommunityJoins(user, gameID)) throw new APIError("无权处理此社群进群", 403);
      if (action === "confirmFriend" && !["requested", "friendReported"].includes(found.status)) throw new APIError("仅待确认的好友申请可以确认", 409);
      if (action === "confirmJoined" && found.status !== "awaitingInvite") throw new APIError("先核实好友通过，再人工拉群并确认", 409);
      if (!["confirmFriend", "confirmJoined"].includes(action)) throw new APIError("操作无效", 400);
      return p.update({ collection: "community-joins", id: found.id, req, overrideAccess: false,
        data: { status: action === "confirmFriend" ? "awaitingInvite" : "joined", note: String(options.note ?? "").trim().slice(0, 500), confirmedBy: user.id, confirmedAt: new Date().toISOString() } });
    });
  } catch (error) {
    // Concurrent initial requests and retries converge on the same receipt.
    if (action === "request" && actor && (databaseCode(error, "23505") || uniqueFieldError(error, "dedupeKey") || (error instanceof APIError && error.status === 409))) {
      const existing = (await p.find({ collection: "community-joins", overrideAccess: false, user: actor, depth: 0, limit: 1,
        where: { and: [{ game: { equals: gameID } }, { member: { equals: actor.id } }, { status: { not_equals: "withdrawn" } }] } })).docs[0];
      if (existing) return existing;
    }
    throw error;
  }
}
