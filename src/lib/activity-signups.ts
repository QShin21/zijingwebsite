import { createHash } from "node:crypto";
import { APIError, type Payload, type PayloadRequest } from "payload";
import type { User } from "@/payload-types";
import { canParticipate, canPublish, canSubmitClubContent, canReadActivitySignups, canExportActivitySignups, managesGame, relationID } from "./rules";
import { canSeeAudience } from "./content-audience";
import { workflowTransaction } from "./workflow-transactions";
import { publicationImages } from "./publication-images";
import { publicationImageRevision } from "./publication-image-storage";
import {
  normalizeSignup,
  validateAnswers,
  visibleQuestions,
  type SignupForm,
} from "./signup-schema";
export function activityKind(value: string): "events" | "community-posts" {
  if (value !== "events" && value !== "community-posts")
    throw new APIError("活动类型无效", 400);
  return value;
}
export function activityId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new APIError("活动不存在", 404);
  return id;
}
const idOf = (value: unknown) =>
  value && typeof value === "object" && "id" in value ? value.id : value;
export const formVersion = (form: SignupForm) =>
  createHash("sha256").update(JSON.stringify(form)).digest("hex");
export async function activity(
  p: Payload,
  kind: "events" | "community-posts",
  id: number,
  user: User | null,
  edit = false,
  req?: PayloadRequest,
  permission: "edit" | "view" | "export" = "edit",
  includeImages = false,
) {
  if (edit && user) {
    // Private-data actions must honor revocation even when an internal caller has an old identity.
    const fresh = await p.findByID({ collection: "users", id: user.id, overrideAccess: true, req, depth: 0,
      select: { roles: true, accountStatus: true, affiliation: true, communityOffices: true } }).catch(() => null);
    user = fresh ? { ...user, ...fresh, accountStatus: fresh.accountStatus, communityOffices: fresh.communityOffices } : null;
  }
  const doc = await p
    .findByID({
      collection: kind,
      id,
      overrideAccess: false,
      user,
      req,
      draft: edit,
      depth: 0,
      ...(includeImages ? { context: { ...req?.context, readSignupImages: true } } : {}),
      select: {
        title: true,
        audience: true,
        signupForm: true,
        ...(includeImages ? { signupImages: true } : {}),
        game: true,
        submittedBy: true,
        author: true,
        category: true,
        status: true,
        _status: true,
        demo: true,
        archived: true,
        lifecycle: true,
        endAt: true,
        registrationStart: true,
        registrationEnd: true,
        registrationClosed: true,
      },
    })
    .catch(() => null);
  if (
    !doc ||
    (kind === "community-posts" &&
      (!("category" in doc) || doc.category !== "event")) ||
    (!edit && (!canSeeAudience(user, doc.audience) ||
      (kind === "events"
        ? !("_status" in doc) ||
          doc._status !== "published" ||
          (process.env.APP_ENV === "production" && "demo" in doc && doc.demo)
        : !("status" in doc) || doc.status !== "visible")))
  )
    throw new APIError("活动未公开或已移除", 404);
  if (!edit && kind === "community-posts") {
    const gameID = Number(relationID(doc.game));
    if (!Number.isSafeInteger(gameID) || gameID <= 0) throw new APIError("活动未公开或已移除", 404);
    const game = await p.findByID({ collection: "games", id: gameID, depth: 0,
      overrideAccess: false, user: null, req: req ? { ...req, user: null } : undefined, draft: false,
      disableErrors: true, select: { _status: true, demo: true } });
    if (!game || game._status !== "published" || process.env.APP_ENV === "production" && game.demo)
      throw new APIError("活动未公开或已移除", 404);
  }
  // Narrow internal lookup for authorization/stamping only; never included in public responses.
  const organizer =
    kind === "events"
      ? idOf(
          (
            await p.findByID({
              collection: "events",
              id,
              overrideAccess: true,
              req,
              depth: 0,
              select: { submittedBy: true },
            })
          ).submittedBy,
        )
      : idOf("author" in doc ? doc.author : null);
  const manager =
    canPublish(user) ||
    (kind === "community-posts"
      ? managesGame(user, idOf(doc.game))
      : canSubmitClubContent(user) &&
        String(organizer) === String(user?.id));
  const canView = canReadActivitySignups(user, kind, doc.game, organizer);
  const canExport = canExportActivitySignups(user, kind, doc.game, organizer);
  if (edit && !(permission === "view" ? canView : permission === "export" ? canExport : manager)) throw new APIError("无权执行此活动报名操作", 403);
  const form = normalizeSignup(doc.signupForm);
  const images = includeImages && "signupImages" in doc ? publicationImages(doc.signupImages) : [];
  return { doc, form, version: formVersion(form), images, manager, organizer, canView, canExport };
}
export function signupState(
  form: SignupForm,
  doc: Record<string, unknown>,
  now = Date.now(),
) {
  if (!form.enabled) return "未启用报名";
  if (
    form.closed ||
    doc.registrationClosed ||
    doc.archived ||
    ["cancelled", "postponed", "ended"].includes(String(doc.lifecycle)) ||
    (doc.endAt && now >= Date.parse(String(doc.endAt)))
  )
    return "报名已关闭";
  if (
    [form.start, doc.registrationStart].some(
      (date) => date && now < Date.parse(String(date)),
    )
  )
    return "报名尚未开始";
  if (
    [form.end, doc.registrationEnd].some(
      (date) => date && now >= Date.parse(String(date)),
    )
  )
    return "报名已截止";
  return "报名开放";
}
export async function ownSignup(
  p: Payload,
  kind: string,
  id: number,
  user: User | null,
  req?: Partial<PayloadRequest>,
) {
  if (!canParticipate(user)) return null;
  const result = await p.find({
    collection: "event-signups",
    overrideAccess: false,
    user,
    req,
    depth: 0,
    limit: 1,
    where: { dedupeKey: { equals: `${kind}:${id}:${user!.id}` } },
    select: {
      answers: true,
      questions: true,
      createdAt: true,
      updatedAt: true,
      formVersion: true,
    },
  });
  return result.docs[0] || null;
}
export async function submitSignup(
  p: Payload,
  kind: "events" | "community-posts",
  id: number,
  user: User | null,
  version: unknown,
  answers: unknown,
) {
  if (!canParticipate(user)) throw new APIError("请先登录可用账号", 401);
  try {
    return await workflowTransaction(p, user, { submitEventSignup: true }, async req => {
      const actor = req.user as User;
      const { doc, form, version: current, organizer } = await activity(p, kind, id, actor, false, req);
      const existing = await ownSignup(p, kind, id, actor, req);
      if (existing) return existing;
      const state = signupState(form, doc);
      if (state !== "报名开放") throw new APIError(state, 409);
      if (version !== current)
        throw new APIError("报名问卷已更新，请刷新并重新填写", 409);
      let clean;
      try { clean = validateAnswers(form, answers); }
      catch (error) { throw new APIError((error as Error).message, 400); }
      const saved = await p.create({
      collection: "event-signups",
      overrideAccess: false,
      req,
      data: {
        activityType: kind,
        activityID: id,
        dedupeKey: `${kind}:${id}:${actor.id}`,
        member: actor.id,
        memberName: actor.name,
        organizer: Number(organizer) || undefined,
        game: Number(idOf(doc.game)) || undefined,
        eventTitle: doc.title,
        formVersion: current,
        questions: visibleQuestions(form, clean),
        answers: clean,
      },
    });
    return {
      id: saved.id,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      formVersion: saved.formVersion,
      questions: saved.questions,
      answers: saved.answers,
    };
    });
  } catch (error) {
    // Database uniqueness also covers simultaneous submissions and network retries.
    if (error instanceof APIError && error.status === 409) {
      // Re-check the activity before returning an existing receipt on a retry.
      await activity(p, kind, id, user);
      const duplicate = await ownSignup(p, kind, id, user);
      if (duplicate) return duplicate;
    }
    throw error;
  }
}
export async function updateSignupAnswers(
  p: Payload,
  kind: "events" | "community-posts",
  id: number,
  user: User | null,
  version: unknown,
  revision: unknown,
  answers: unknown,
) {
  if (!canParticipate(user)) throw new APIError("请先登录可用账号", 401);
  return workflowTransaction(p, user, { updateEventSignup: true }, async req => {
    const actor = req.user as User;
    const { doc, form, version: current } = await activity(p, kind, id, actor, false, req);
    const state = signupState(form, doc);
    if (state !== "报名开放") throw new APIError(state + "，暂不能修改作答", 409);
    if (version !== current) throw new APIError("报名问卷已更新，请刷新后再修改作答", 409);
    let clean;
    try { clean = validateAnswers(form, answers); }
    catch (error) { throw new APIError((error as Error).message, 400); }
    const existing = await ownSignup(p, kind, id, actor, req);
    if (!existing) throw new APIError("尚未提交报名，请先填写问卷", 404);
    if (typeof revision !== "string" || revision !== existing.updatedAt)
      throw new APIError("作答记录已更新，请重新加载上次提交的内容后修改", 409);
    const saved = await p.update({
      collection: "event-signups",
      id: existing.id,
      overrideAccess: false,
      req,
      depth: 0,
      data: {
        formVersion: current,
        questions: visibleQuestions(form, clean),
        answers: clean,
      },
    });
    return {
      id: saved.id,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      formVersion: saved.formVersion,
      questions: saved.questions,
      answers: saved.answers,
    };
  });
}
export async function saveSignupForm(
  p: Payload,
  kind: "events" | "community-posts",
  id: number,
  user: User | null,
  version: unknown,
  value: unknown,
  illustrations?: { revision: unknown; images: unknown },
) {
  const editImages = illustrations !== undefined;
  return workflowTransaction(p, user, {
    manageSignupForm: true,
    ...(editImages ? { manageSignupImages: true, readSignupImages: true } : {}),
  }, async req => {
    const actor = req.user as User;
    const current = await activity(p, kind, id, actor, true, req, "edit", editImages);
    if (version !== current.version) throw new APIError("报名问卷已被更新，请刷新后再编辑", 409);
    let form;
    try { form = normalizeSignup(value); }
    catch (error) { throw new APIError((error as Error).message, 400); }
    if (illustrations && illustrations.revision !== publicationImageRevision(current.images))
      throw new APIError("问卷配图已更新，请重新加载后编辑。", 409);
    const images = illustrations?.images;
    if (illustrations && !Array.isArray(images)) throw new APIError("问卷配图格式无效。", 400);
    const draft = kind === "events" && !canPublish(actor);
    const saved = await p.update({
      collection: kind, id, overrideAccess: false, req,
      ...(kind === "events" ? { draft } : {}),
      data: { signupForm: form, ...(editImages && Array.isArray(images) ? { signupImages: images } : {}) },
    });
    const savedImages = publicationImages(saved.signupImages);
    return {
      form, version: formVersion(form), draft,
      ...(editImages ? { images: savedImages, imageRevision: publicationImageRevision(savedImages) } : {}),
      message: draft ? "问卷草稿已保存，需发布负责人审核发布后生效" : "报名问卷已保存",
    };
  });
}
