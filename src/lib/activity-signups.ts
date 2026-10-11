import { createHash } from "node:crypto";
import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import { canParticipate, canPublish, hasRole, managesGame } from "./rules";
import {
  normalizeSignup,
  validateAnswers,
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
) {
  if (kind === "community-posts" && !canParticipate(user))
    throw new APIError("请先登录", 401);
  const doc = await p
    .findByID({
      collection: kind,
      id,
      overrideAccess: false,
      user: edit ? user : null,
      draft: edit,
      depth: 0,
      select: {
        title: true,
        signupForm: true,
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
    (!edit &&
      (kind === "events"
        ? !("_status" in doc) ||
          doc._status !== "published" ||
          (process.env.APP_ENV === "production" && "demo" in doc && doc.demo)
        : !("status" in doc) || doc.status !== "visible"))
  )
    throw new APIError("活动未公开或已移除", 404);
  // Narrow internal lookup for authorization/stamping only; never included in public responses.
  const organizer =
    kind === "events"
      ? idOf(
          (
            await p.findByID({
              collection: "events",
              id,
              overrideAccess: true,
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
      : hasRole(user, "communityAdmin") &&
        String(organizer) === String(user?.id));
  if (edit && !manager) throw new APIError("无权管理此活动报名", 403);
  const form = normalizeSignup(doc.signupForm);
  return { doc, form, version: formVersion(form), manager, organizer };
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
) {
  if (!canParticipate(user)) return null;
  const result = await p.find({
    collection: "event-signups",
    overrideAccess: false,
    user,
    depth: 0,
    limit: 1,
    where: { dedupeKey: { equals: `${kind}:${id}:${user!.id}` } },
    select: { answers: true, questions: true, createdAt: true },
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
  const {
    doc,
    form,
    version: current,
    organizer,
  } = await activity(p, kind, id, user);
  const existing = await ownSignup(p, kind, id, user);
  if (existing) return existing;
  const state = signupState(form, doc);
  if (state !== "报名开放") throw new APIError(state, 409);
  if (version !== current)
    throw new APIError("报名问卷已更新，请刷新并重新填写", 409);
  let clean;
  try {
    clean = validateAnswers(form, answers);
  } catch (error) {
    throw new APIError((error as Error).message, 400);
  }
  try {
    const saved = await p.create({
      collection: "event-signups",
      overrideAccess: false,
      user,
      context: { submitEventSignup: true },
      data: {
        activityType: kind,
        activityID: id,
        dedupeKey: `${kind}:${id}:${user!.id}`,
        member: user!.id,
        memberName: user!.name,
        organizer: Number(organizer) || undefined,
        game: Number(idOf(doc.game)) || undefined,
        eventTitle: doc.title,
        formVersion: current,
        questions: form.questions,
        answers: clean,
      },
    });
    return {
      id: saved.id,
      createdAt: saved.createdAt,
      questions: saved.questions,
      answers: saved.answers,
    };
  } catch (error) {
    // Database uniqueness also covers simultaneous submissions and network retries.
    const duplicate = await ownSignup(p, kind, id, user);
    if (duplicate) return duplicate;
    throw error;
  }
}
export async function saveSignupForm(
  p: Payload,
  kind: "events" | "community-posts",
  id: number,
  user: User | null,
  version: unknown,
  value: unknown,
) {
  const current = await activity(p, kind, id, user, true);
  if (version !== current.version)
    throw new APIError("报名问卷已被更新，请刷新后再编辑", 409);
  let form;
  try {
    form = normalizeSignup(value);
  } catch (error) {
    throw new APIError((error as Error).message, 400);
  }
  const draft = kind === "events" && !canPublish(user);
  await p.update({
    collection: kind,
    id,
    overrideAccess: false,
    user,
    context: { manageSignupForm: true },
    ...(kind === "events" ? { draft } : {}),
    data: { signupForm: form },
  });
  return {
    form,
    version: formVersion(form),
    message: draft
      ? "问卷草稿已保存，需发布负责人审核发布后生效"
      : "报名问卷已保存",
    draft,
  };
}
