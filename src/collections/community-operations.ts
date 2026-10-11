import { createHash } from "node:crypto";
import { APIError, type Access, type CollectionConfig, type CollectionAfterChangeHook, type Where } from "payload";
import { canParticipate, canPublish, canReviewCommunityApplication, communityIDs, relationID, type Identity } from "../lib/rules";
import { MAX_WECHAT_QR_TEXT_LENGTH, normalizeWechatQr, validApplicantName, validApplicantPhone } from "../lib/application-details";

const ownApplication: Access = ({ req }) => {
  if (req.context.publicCommunityContacts) return { and: [{ game: { equals: req.context.publicCommunityContacts } }, { status: { equals: "approved" } }, { contactConsent: { equals: true } }] } as Where;
  if (canReviewCommunityApplication(req.user as Identity)) return true;
  return canParticipate(req.user as Identity) ? { applicant: { equals: req.user!.id } } : false;
};
// Payload 3 beforeValidate merges unchanged original fields into data before collection hooks.
const changedOutside = (data: Record<string, unknown>, original: Record<string, unknown> | undefined, allowed: string[]) =>
  Object.keys(data).some(key => !allowed.includes(key) && data[key] !== undefined && JSON.stringify(relationID(data[key])) !== JSON.stringify(relationID(original?.[key])));
const workflowAudit: CollectionAfterChangeHook = async ({ doc, previousDoc, req, collection, operation }) => {
  if (req.context.applicationResolved) return doc;
  await req.payload.create({ collection: "audit", overrideAccess: true, req, data: {
    actor: String(req.user?.id ?? "system"), object: `${collection.slug}:${doc.id}`,
    action: previousDoc?.status !== doc.status ? `${operation}:${previousDoc?.status ?? "new"}->${doc.status}` : operation,
    status: doc.status,
  } });
  return doc;
};

export const CommunityApplications: CollectionConfig = {
  slug: "community-applications", labels: { singular: "建群与管理员申请", plural: "建群与管理员申请" },
  admin: { useAsTitle: "proposedGame", description: "在网站社群申请审核页处理决定、退回及初始化；平台角色不会随审批改变。" },
  access: {
    read: ownApplication,
    create: ({ req }) => canParticipate(req.user as Identity),
    update: ({ req }) => req.context.applicationResolved === true || (req.context.communityApplicationDecision === true && canReviewCommunityApplication(req.user as Identity))
      ? true : (req.context.communityApplicationEdit === true || req.context.communityContactEdit === true) && canParticipate(req.user as Identity) ? { applicant: { equals: req.user!.id } } : false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [async ({ data, originalDoc, req, operation }) => {
      if (req.context.applicationResolved === true) return data;
      if (!canParticipate(req.user as Identity)) throw new APIError("请登录可用账号", 403);
      if (operation === "update" && req.context.communityContactEdit === true) {
        if (originalDoc?.status !== "approved" || String(relationID(originalDoc.applicant)) !== String(req.user!.id)) throw new APIError("只能更新本人已批准的名片", 403);
        if (changedOutside(data, originalDoc, ["wechatQr", "contactConsent", "updatedAt"])) throw new APIError("名片设置不能修改审核资料", 403);
        if (data.wechatQr) try { data.wechatQr = await normalizeWechatQr(data.wechatQr); } catch { throw new APIError("请上传 2 MB 以内的有效微信名片二维码图片", 400); }
        data.contactConsent = data.contactConsent === true;
        return data;
      }
      if (operation === "update" && req.context.communityApplicationDecision === true) {
        if (!canReviewCommunityApplication(req.user as Identity)) throw new APIError("无权审核申请", 403);
        if (originalDoc?.status !== "pending") throw new APIError("申请已经处理", 409);
        if (!["approved", "returned", "rejected"].includes(data.status)) throw new APIError("审核决定无效", 400);
        if (changedOutside(data, originalDoc, ["status", "reviewNote", "updatedAt"])) throw new APIError("审核时不能修改申请资料", 403);
        data.reviewNote = String(data.reviewNote ?? "").trim();
        if (data.status !== "approved" && !data.reviewNote) throw new APIError("退回或拒绝需填写具体原因", 400);
        if (data.status === "approved" && (!originalDoc.realName || !originalDoc.phone || !originalDoc.wechatQr)) throw new APIError("旧申请资料不全，请退回后由申请人重新提交", 400);
        const applicant = await req.payload.findByID({ collection: "users", id: Number(relationID(originalDoc.applicant)), req, overrideAccess: true, depth: 0 });
        if (!canParticipate(applicant)) throw new APIError("申请者账号已停用，不能批准任职", 409);
        data.reviewedBy = req.user!.id;
        data.reviewedAt = new Date().toISOString();
        return data;
      }
      if (operation === "update") {
        if (req.context.communityApplicationEdit !== true || String(relationID(originalDoc?.applicant)) !== String(req.user!.id)) throw new APIError("请从本人申请入口修改", 403);
        if (data.status === "withdrawn" && originalDoc?.status === "pending") {
          if (changedOutside(data, originalDoc, ["status", "updatedAt"])) throw new APIError("撤回不能同时修改申请资料", 403);
          return data;
        }
        if (!["returned", "withdrawn"].includes(originalDoc?.status)) throw new APIError("仅退回或撤回申请可以修改重提", 409);
        if (data.status !== "pending") throw new APIError("申请状态无效", 400);
      }
      const merged = { ...originalDoc, ...data };
      data.realName = String(merged.realName ?? "").trim();
      data.phone = String(merged.phone ?? "").trim();
      if (!validApplicantName(data.realName)) throw new APIError("请填写 1–80 字的姓名", 400);
      if (!validApplicantPhone(data.phone)) throw new APIError("手机号需为 6–20 位数字，可在开头添加 + 国际区号", 400);
      try { data.wechatQr = await normalizeWechatQr(merged.wechatQr); }
      catch { throw new APIError("请上传 2 MB 以内的有效微信名片二维码图片", 400); }
      const gameID = Number(relationID(merged.game)) || null;
      if (gameID) {
        const game = await req.payload.findByID({ collection: "games", id: gameID, req: { ...req, user: null }, user: null, overrideAccess: false, depth: 0, draft: false }).catch(() => null);
        if (!game || game._status !== "published") throw new APIError("该社群尚未开放", 404);
        data.proposedGame = game.title;
      } else {
        data.proposedGame = String(merged.proposedGame ?? "").trim();
        if (data.proposedGame.length < 2 || data.proposedGame.length > 80) throw new APIError("新游戏名称需为 2–80 字", 400);
        const existingGame = await req.payload.find({ collection: "games", req: { ...req, user: null }, user: null, overrideAccess: false, draft: false, depth: 0, limit: 1,
          where: { and: [{ title: { equals: data.proposedGame } }, { _status: { equals: "published" } }] }, select: { title: true } });
        if (existingGame.docs.length) throw new APIError("该游戏已有社群，请在已有游戏中选择后申请参与组织", 409);
      }
      data.reason = String(merged.reason ?? "").trim();
      if (data.reason.length < 10 || data.reason.length > 3000) throw new APIError("请填写 10–3000 字的申请说明", 400);
      data.applicant = req.user!.id;
      data.game = gameID;
      data.contactConsent = merged.contactConsent === true;
      data.status = "pending";
      data.reviewNote = null;
      data.reviewedBy = null;
      data.reviewedAt = null;
      data.requestKey = createHash("sha256").update(`${req.user!.id}:${gameID ? `game:${gameID}` : `name:${data.proposedGame.toLocaleLowerCase("zh-CN")}`}`).digest("hex");
      const duplicate = await req.payload.find({ collection: "community-applications", req, overrideAccess: true, limit: 1, depth: 0,
        where: { and: [{ requestKey: { equals: data.requestKey } }, ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : [])] }, select: { status: true } });
      if (duplicate.docs.length) throw new APIError("已有同一申请，请在我的申请中继续处理", 409);
      // Historical rows retain their own unique IDs; do not permit a second flow around them.
      const oldRequests = await req.payload.find({ collection: "community-applications", req, overrideAccess: true, pagination: false, depth: 0,
        where: { applicant: { equals: req.user!.id } }, select: { game: true, proposedGame: true } });
      if (oldRequests.docs.some(app => app.id !== originalDoc?.id && (gameID ? Number(relationID(app.game)) === gameID : app.proposedGame.trim().toLocaleLowerCase("zh-CN") === data.proposedGame.toLocaleLowerCase("zh-CN")))) throw new APIError("已有同一申请，请在我的申请中继续处理", 409);
      return data;
    }],
    afterChange: [async ({ doc, previousDoc, req }) => {
      if (doc.status !== "approved" || previousDoc?.status === "approved" || req.context.applicationResolved) return doc;
      // Decision service holds a serializable transaction, including initialization and grant.
      let game = Number(relationID(doc.game));
      if (!game) {
        const existing = await req.payload.find({ collection: "games", overrideAccess: true, req, where: { and: [{ title: { equals: doc.proposedGame } }, { _status: { equals: "published" } }] }, limit: 1, depth: 0 });
        game = existing.docs[0]?.id ?? (await req.payload.create({ collection: "games", req: { ...req, context: { ...req.context, system: true } }, overrideAccess: true, data: { title: doc.proposedGame, slug: `community-${doc.id}`, _status: "published", reviewState: "approved" } })).id;
      }
      const applicant = await req.payload.findByID({ collection: "users", id: Number(relationID(doc.applicant)), req, overrideAccess: true, depth: 0 });
      const offices = [...(applicant.communityOffices ?? [])];
      const index = offices.findIndex(office => Number(relationID(office.game)) === game);
      const grant = { game, status: "active" as const, publishContent: true, reviewShowcase: true, handleJoins: true,
        viewSignups: false, exportSignups: false, contactConsent: doc.contactConsent === true,
        grantedBy: req.user!.id, grantedAt: new Date().toISOString(), sourceApplication: doc.id };
      if (index < 0) offices.push(grant);
      else if (offices[index].status !== "active") offices[index] = { ...offices[index], ...grant };
      else offices[index] = { ...offices[index], contactConsent: doc.contactConsent === true, sourceApplication: doc.id };
      // Platform roles and other offices remain intact. Approval makes no claim about WeChat membership.
      await req.payload.update({ collection: "users", id: applicant.id, req: { ...req, context: { ...req.context, system: true } }, overrideAccess: true, data: { communityOffices: offices } });
      await req.payload.update({ collection: "community-applications", id: doc.id, req: { ...req, context: { ...req.context, applicationResolved: true } }, overrideAccess: true, data: { game } });
      return { ...doc, game };
    }, workflowAudit],
  },
  fields: [
    { name: "applicant", type: "relationship", relationTo: "users", required: true, maxDepth: 0 },
    { name: "game", type: "relationship", relationTo: "games", maxDepth: 0 },
    { name: "proposedGame", label: "游戏名称", type: "text", required: true },
    { name: "reason", label: "运营计划与申请说明", type: "textarea", required: true, maxLength: 3000 },
    { name: "realName", label: "姓名", type: "text", maxLength: 80 },
    { name: "phone", label: "手机号", type: "text", maxLength: 21 },
    { name: "wechatQr", type: "textarea", maxLength: MAX_WECHAT_QR_TEXT_LENGTH, admin: { hidden: true } },
    { name: "contactConsent", label: "同意在任期间向登录成员展示名片", type: "checkbox", defaultValue: false },
    { name: "requestKey", type: "text", unique: true, admin: { hidden: true }, access: { read: () => false } },
    { name: "status", type: "select", defaultValue: "pending", options: ["pending", "approved", "returned", "rejected", "withdrawn"] },
    { name: "reviewNote", label: "处理意见", type: "textarea", maxLength: 1000 },
    { name: "reviewedBy", type: "relationship", relationTo: "users", maxDepth: 0 },
    { name: "reviewedAt", type: "date" },
  ],
};

export const CommunityJoins: CollectionConfig = {
  slug: "community-joins", labels: { singular: "人工进群记录", plural: "人工进群记录" },
  admin: { useAsTitle: "memberName", description: "扫码或网站操作均不证明已进微信群；在社群进群管理页人工处理。" },
  access: {
    read: ({ req }) => {
      const user = req.user as Identity;
      if (!canParticipate(user)) return false;
      if (canPublish(user)) return true;
      return { or: [{ member: { equals: user.id } }, { game: { in: communityIDs(user, "handleJoins") } }] } as Where;
    },
    create: ({ req }) => canParticipate(req.user as Identity) && req.context.communityJoinWrite === true,
    update: ({ req }) => req.context.communityJoinWrite === true && canParticipate(req.user as Identity)
      ? canPublish(req.user as Identity) || { or: [{ member: { equals: req.user!.id } }, { game: { in: communityIDs(req.user as Identity, "handleJoins") } }] } as Where : false,
    delete: () => false,
  },
  hooks: { beforeChange: [({ req, data, operation, originalDoc }) => {
    if (req.context.communityJoinWrite !== true) throw new APIError("请通过进群流程操作", 403);
    if (operation === "update" && ["member", "game", "dedupeKey", "memberName"].some(key => data[key] !== undefined && String(relationID(data[key])) !== String(relationID(originalDoc?.[key])))) throw new APIError("不能转移进群记录", 403);
    return data;
  }], afterChange: [workflowAudit] },
  fields: [
    { name: "member", type: "relationship", relationTo: "users", required: true, maxDepth: 0 },
    { name: "game", type: "relationship", relationTo: "games", required: true, maxDepth: 0 },
    { name: "contact", label: "联系管理员", type: "relationship", relationTo: "users", maxDepth: 0 },
    { name: "memberName", type: "text", required: true },
    { name: "dedupeKey", type: "text", unique: true, required: true, admin: { hidden: true } },
    { name: "status", type: "select", required: true, options: ["requested", "friendReported", "awaitingInvite", "joined", "withdrawn"] },
    { name: "note", label: "处理说明", type: "textarea", maxLength: 500 },
    { name: "confirmedBy", type: "relationship", relationTo: "users", maxDepth: 0 },
    { name: "confirmedAt", type: "date" },
  ],
};
