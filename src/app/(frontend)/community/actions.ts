"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { workflowFeedback } from "@/components/activity-pages/action-feedback";
import { redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { canPublish, canSubmitClubContent, canReviewShowcase, managesGame } from "@/lib/rules";
import { discardVideo, saveVideo, VIDEO_MAX_BYTES, SUBMISSION_MAX_BYTES } from '@/lib/showcase-videos';
import { decideCommunityApplication, editCommunityApplication, updateCommunityCard } from "@/lib/community-operations";
import { applicationError } from "@/lib/application-error";
import { workflowTransaction } from "@/lib/workflow-transactions";
import { APIError } from "payload";
import type { User } from "@/payload-types";
import { applicationContactConsentRequiredMessage } from "@/lib/community-status";
import { beijingScheduleTime, communitySchedule, updateCommunityPostSchedule } from "@/lib/v2/schedule";
import { reviewShowcase, submitShowcase } from "@/lib/v2/writes";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const numeric = (form: FormData, key: string) => {
  const number = Number(value(form, key));
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};
const problem = (path: string, message: string) => redirect(`${path}?message=${encodeURIComponent(message)}`);
async function current() {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!user || user.accountStatus === "suspended") redirect("/login");
  return { p, user };
}
async function gamePath(id: number) {
  const game = await (await cms()).findByID({
    collection: "games", id, user: null, overrideAccess: false, draft: false, depth: 0,
  }).catch(() => null);
  return game ? `/community/${game.slug}` : "/community";
}
export async function applyAction(form: FormData) {
  const { p, user } = await current();
  if (form.get("contactConsent") !== "on") return { error: applicationContactConsentRequiredMessage, field: "contactConsent" };
  const game = numeric(form, "game");
  const id = numeric(form, "id");
  const image = form.get("wechatQr");
  const file = image instanceof File && image.size ? image : null;
  if ((!id && !file) || (file && (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))))
    return { error: "请上传 2 MB 以内的 PNG、JPEG 或 WebP 微信名片二维码。" };
  try {
    const data = { game: game || null, proposedGame: value(form, "proposedGame"),
      realName: value(form, "realName"), phone: value(form, "phone"),
      ...(file ? { wechatQr: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` } : {}),
      contactConsent: form.get("contactConsent") === "on", reason: value(form, "reason"), status: "pending" as const, applicant: user.id };
    if (id) await editCommunityApplication(p, user, id, value(form, "revision"), data);
    else await p.create({ collection: "community-applications", overrideAccess: false, user, data });
  } catch (error) { return { error: applicationError(error) }; }
  return { success: true };
}
export async function decideAction(form: FormData) {
  const { p, user } = await current();
  if (!canPublish(user)) redirect("/account");
  const status = value(form, "decision");
  if (!["approved", "returned", "rejected"].includes(status)) problem("/community/review", "决定无效");
  try {
    await decideCommunityApplication(p, user, numeric(form, "id"), status, value(form, "reviewNote"), value(form, "revision"));
  } catch (error) { problem("/community/review", applicationError(error)); }
  redirect("/community/review?done=1");
}
async function createCommunityPost(
  p: Awaited<ReturnType<typeof cms>>,
  user: User,
  form: FormData,
  category: "event" | "notice",
) {
  const game = numeric(form, "game");
  if (!managesGame(user, game)) throw new APIError("无权在此社群发布", 403);
  const signupForm = category === "event" && value(form, "signupForm")
    ? JSON.parse(value(form, "signupForm"))
    : undefined;
  const postImages = JSON.parse(value(form, "postImages") || "[]");
  const signupImages = signupForm?.enabled === true
    ? JSON.parse(value(form, "signupImages") || "[]")
    : [];
  if (!Array.isArray(postImages) || !Array.isArray(signupImages))
    throw new APIError("请检查配图格式。", 400);

  return p.create({
    collection: "community-posts",
    overrideAccess: false,
    user,
    context: { manageSignupForm: true, manageSignupImages: true },
    data: {
      game,
      author: user.id,
      title: value(form, "title"),
      body: value(form, "body"),
      category,
      contentMode: value(form, "contentMode") || "gallery",
      contentBlocks: value(form, "contentMode") === "article" ? JSON.parse(value(form, "contentBlocks") || "[]") : null,
      ...communitySchedule({ startAt: beijingScheduleTime(value(form, "startAt")),
        endAt: beijingScheduleTime(value(form, "endAt")), location: value(form, "location") }, category),
      signupForm,
      postImages,
      signupImages,
    },
  });
}
export async function publishCommunityAction(form: FormData) {
  const { p, user } = await current();
  const game = numeric(form, "game");
  const kind = value(form, "kind");
  const path = `${await gamePath(game)}/updates`;
  if (kind !== "event" && kind !== "notice") problem(path, "发布类型无效");
  try {
    await createCommunityPost(p, user, form, kind as "event" | "notice");
  } catch { problem(path, "发布未成功，请核对内容和权限"); }
  redirect(path);
}
export async function moderateAction(form: FormData) {
  const { p, user } = await current();
  const collection = (["community-posts"] as const)
    .find((name) => name === value(form, "collection"));
  if (!collection) redirect("/community");
  const id = numeric(form, "id");
  const status = value(form, "status");
  const game = numeric(form, "game");
  const path = await gamePath(game);
  if (!managesGame(user, game) || !["visible", "hidden"].includes(status)) redirect(path);
  try {
    await p.update({ collection, id, overrideAccess: false, user,
      data: { status: status as "visible" | "hidden" } });
  } catch { problem(path, "管理操作未成功"); }
  redirect(path);
}
export async function banAction(form: FormData) {
  const { p, user } = await current();
  const game = numeric(form, "game");
  const path = await gamePath(game);
  if (!managesGame(user, game) || !canSubmitClubContent(user))
    redirect(path);
  try {
    await p.create({ collection: "community-bans", overrideAccess: false, user,
      data: { game, member: numeric(form, "member"), reason: value(form, "reason"), active: true } });
  } catch { problem(path, "禁言未完成"); }
  redirect(path);
}

export async function submitShowcaseAction(form: FormData) {
  const p = await cms(); const { user } = await p.auth({ headers: await headers() });
  if (!user || user.accountStatus === "suspended") return { error: "请先登录可用账号" };
  const files = form.getAll("images").filter(f => f instanceof File && f.size) as File[];
  if (files.length > 6 || files.some(f => f.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(f.type))) return { error: "最多 6 张 PNG、JPEG、WebP 照片，每张 2 MB 以内" };
  const video = form.get('video');
  const videoFile = video instanceof File && video.size ? video : null;
  if (!value(form, 'title')) return { error: '请填写标题' };
  if (videoFile && value(form, 'videoURL')) return { error: '上传视频与视频链接请选择一种' };
  if ((videoFile?.size || 0) > VIDEO_MAX_BYTES || files.reduce((sum, file) => sum + file.size, videoFile?.size || 0) > SUBMISSION_MAX_BYTES) return { error: '视频不超过 10 MB，图片与视频合计不超过 12 MB' };
  let uploaded = '';
  try {
    const images = await Promise.all(files.map(async file => ({ source: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`, caption: value(form, "caption") })));
    if (videoFile) uploaded = await saveVideo(videoFile);
    await submitShowcase(p, user, { game: numeric(form, "game"), title: value(form, "title"), body: value(form, "body"), videoURL: uploaded || value(form, "videoURL"), images });
    return { success: true };
  } catch (error) { if (uploaded) await discardVideo(uploaded); return { error: applicationError(error) }; }
}
export async function reviewShowcaseAction(form: FormData) {
  const { p, user } = await current();
  const post = await p.findByID({ collection: "community-showcase", id: numeric(form, "id"), overrideAccess: false, user, depth: 0 }).catch(() => null);
  if (!post || !canReviewShowcase(user, post.game)) redirect("/community");
  const path = `${await gamePath(Number(post.game))}/showcase`;
  const status = value(form, "status");
  if (!["visible", "rejected", "hidden"].includes(status)) problem(path, "审核决定无效");
  try { await reviewShowcase(p, user, { id: post.id, decision: status, reviewNote: value(form, "reviewNote"), revision: value(form, "revision") }); }
  catch { problem(path, "审核未成功，请刷新后重试"); }
  redirect(`${path}?view=review&message=${encodeURIComponent("审核已保存")}`);
}
export async function updateCommunityPostScheduleAction(form: FormData) {
  const { p, user } = await current();
  try {
    const saved = await updateCommunityPostSchedule(p, user, { id: numeric(form, "id"), revision: value(form, "revision"),
      startAt: value(form, "startAt"), endAt: value(form, "endAt"), location: value(form, "location") });
    const path = `${await gamePath(Number(saved.game))}/updates`;
    revalidatePath(path); revalidatePath("/events"); revalidatePath("/");
    return { ok: true, message: "活动日程已更新。" };
  } catch (error) { return { ok: false, message: applicationError(error) }; }
}
export async function replaceShowcaseVideoAction(form: FormData) {
  const { p, user } = await current(), id = numeric(form, "id");
  let uploaded = "", game = 0, message = "本站视频已更新，已升推内容会同步更新。";
  try {
    await workflowTransaction(p, user, { webShowcaseWrite: true }, async req => {
      const post = await p.findByID({ collection: "community-showcase", id, req, overrideAccess: false, depth: 0 });
      game = Number(post.game);
      if (!canReviewShowcase(req.user, post.game)) throw new APIError("无权修改此社群风采视频", 403);
      if (value(form, "revision") !== post.updatedAt) throw new APIError("风采已更新，请刷新后再上传", 409);
      const file = form.get("video");
      if (!(file instanceof File) || !file.size) throw new APIError("请选择 10 MB 以内的 MP4 视频", 400);
      uploaded = await saveVideo(file);
      await p.update({ collection: "community-showcase", id, req, overrideAccess: false, data: { videoURL: uploaded } });
    });
  } catch (error) { if (uploaded) await discardVideo(uploaded); message = applicationError(error); }
  const path = (await gamePath(game)) + "/showcase/" + id;
  redirect(path + "?message=" + encodeURIComponent(message));
}

export async function withdrawApplicationAction(form: FormData) {
  const { p, user } = await current();
  try { await editCommunityApplication(p, user, numeric(form, "id"), value(form, "revision"), { status: "withdrawn" }); }
  catch (error) { problem("/community/apply", applicationError(error)); }
  redirect("/community/apply?message=" + encodeURIComponent("网站申请已撤回，微信联系不受此操作影响。"));
}
export async function updateCommunityCardAction(form: FormData) {
  const { p, user } = await current();
  const file = form.get("wechatQr");
  if (file instanceof File && file.size > 2 * 1024 * 1024) problem("/community/apply", "名片最大 2 MB");
  try { await updateCommunityCard(p, user, numeric(form, "id"), value(form, "revision"), {
    contactConsent: form.get("contactConsent") === "on",
    ...(file instanceof File && file.size ? { wechatQr: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` } : {}),
  }); }
  catch (error) { problem("/community/apply", applicationError(error)); }
  redirect("/community/apply?message=" + encodeURIComponent("名片及展示设置已更新。"));
}

// Structured presentation adapters preserve rejected form values; legacy redirects remain available.
export async function publishCommunityResultAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  if (!user || user.accountStatus === "suspended") return { ok: false, message: "请重新登录后再发布，已填写的内容保留。" };
  const game = numeric(form, "game"), kind = value(form, "kind");
  if (kind !== "event" && kind !== "notice") return { ok: false, message: "发布类型无效，请重新选择。" };
  try {
    await createCommunityPost(p, user, form, kind);
    revalidatePath(`${await gamePath(game)}/updates`);
    if (kind === "event") revalidatePath("/events");
    return { ok: true, message: "内容已发布到当前社群。" };
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
}
export async function updateCommunityPostImagesAction(form: FormData) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const id = numeric(form, "id");
  const game = numeric(form, "game");
  let path: string;
  try {
    path = await workflowTransaction(p, user, {}, async (req) => {
      if (!id || !game || !managesGame(req.user, game))
        throw new APIError("当前账号无权编辑此社群的配图。", 403);
      const post = await p.findByID({
        collection: "community-posts", id, req, overrideAccess: false, depth: 0,
        select: { game: true, status: true, updatedAt: true },
      });
      if (Number(post.game) !== game || post.status !== "visible")
        throw new APIError("该内容已隐藏或不属于当前社群。", 404);
      if (value(form, "revision") !== post.updatedAt)
        throw new APIError("内容已有更新，请刷新已保存记录，再载入最新配图。", 409);
      const currentGame = await p.findByID({
        collection: "games", id: game, req: { ...req, user: null },
        overrideAccess: false, user: null, draft: false, depth: 0, select: { slug: true },
      });
      let images: unknown;
      try { images = JSON.parse(value(form, "postImages")); }
      catch { throw new APIError("请检查配图格式。", 400); }
      if (!Array.isArray(images)) throw new APIError("请检查配图格式。", 400);
      await p.update({
        collection: "community-posts", id, req, overrideAccess: false, data: { postImages: images },
      });
      return `/community/${currentGame.slug}/updates/${id}`;
    });
  } catch (error) {
    return { ok: false, message: workflowFeedback(error) };
  }
  revalidatePath(path);
  revalidatePath("/events");
  revalidatePath("/");
  return { ok: true, message: "配图已保存。" };
}

export async function updateCommunityArticleAction(form: FormData) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const id = numeric(form, "id"), game = numeric(form, "game");
  let path: string;
  try {
    path = await workflowTransaction(p, user, {}, async req => {
      if (!id || !game || !managesGame(req.user, game)) throw new APIError("当前账号无权编辑此社群内容。", 403);
      const post = await p.findByID({ collection: "community-posts", id, req, overrideAccess: false, depth: 0,
        select: { game: true, status: true, updatedAt: true, contentMode: true } });
      if (Number(post.game) !== game || post.status !== "visible" || post.contentMode !== "article")
        throw new APIError("内容已隐藏或不属于当前社群。", 404);
      if (value(form, "revision") !== post.updatedAt) throw new APIError("内容已有更新，请刷新后重新编辑。", 409);
      let images: unknown, blocks: unknown;
      try { images = JSON.parse(value(form, "postImages")); blocks = JSON.parse(value(form, "contentBlocks")); }
      catch { throw new APIError("请检查文章内容。", 400); }
      if (!Array.isArray(images) || !Array.isArray(blocks)) throw new APIError("请检查文章内容。", 400);
      await p.update({ collection: "community-posts", id, req, overrideAccess: false,
        data: { postImages: images, contentMode: "article", contentBlocks: blocks } });
      const parent = await p.findByID({ collection: "games", id: game, req: { ...req, user: null },
        user: null, overrideAccess: false, draft: false, depth: 0, select: { slug: true } });
      return `/community/${parent.slug}/updates/${id}`;
    });
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
  revalidatePath(path); revalidatePath("/events"); revalidatePath("/");
  return { ok: true, message: "文章已保存。" };
}

export async function reviewShowcaseResultAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  if (!user || user.accountStatus === "suspended") return { ok: false, message: "请重新登录后再审核，已填写的说明保留。" };
  const post = await p.findByID({ collection: "community-showcase", id: numeric(form, "id"), overrideAccess: false, user, depth: 0 }).catch(() => null);
  if (!post || !canReviewShowcase(user, post.game)) return { ok: false, message: "当前账号无法审核这条社群风采。" };
  const status = value(form, "status");
  if (!["visible", "rejected", "hidden"].includes(status)) return { ok: false, message: "审核决定无效，请重新选择。" };
  try {
    await reviewShowcase(p, user, { id: post.id, decision: status, reviewNote: value(form, "reviewNote"), revision: value(form, "revision") });
    const path = `${await gamePath(Number(post.game))}/showcase`;
    revalidatePath(path);
    const requested = new URLSearchParams(value(form, "returnQuery")), query = new URLSearchParams();
    const view = requested.get("view"), page = requested.get("page");
    query.set("view", view === "public" || view === "mine" ? view : "review");
    if (page && /^\d+$/.test(page) && Number(page) > 0 && Number(page) <= 100000) query.set("page", page);
    const message = "审核结果已保存。";
    query.set("message", message);
    return { ok: true, message, successHref: path + "?" + query.toString() };
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
}

/** Presentation adapters keep legacy deep links and business services intact. */
function resultPage(form: FormData) {
  const page = value(form, "returnPage");
  return /^\d+$/.test(page) && Number(page) > 1 && Number(page) <= 100000 ? `&page=${page}` : "";
}
export async function decideCommunityResultAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  if (!user || user.accountStatus === "suspended") return { ok: false, message: "请重新登录后再审核，已填写的意见保留。" };
  if (!canPublish(user)) return { ok: false, message: "当前账号无权审核社群管理员申请。" };
  const decision = value(form, "decision");
  if (!["approved", "returned", "rejected"].includes(decision)) return { ok: false, message: "审核决定无效，请重新选择。" };
  try {
    await decideCommunityApplication(p, user, numeric(form, "id"), decision, value(form, "reviewNote"), value(form, "revision"));
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
  revalidatePath("/community/review");
  revalidatePath("/community/apply");
  return { ok: true, message: "审核结果已保存。", successHref: "/community/review?done=1" + resultPage(form) };
}
export async function updateCommunityCardResultAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  if (!user || user.accountStatus === "suspended") return { ok: false, message: "请重新登录后再保存，已选择的名片与展示设置保留。" };
  const file = form.get("wechatQr");
  if (file instanceof File && file.size > 2 * 1024 * 1024) return { ok: false, message: "名片最大 2 MB，请重新选择。" };
  try {
    await updateCommunityCard(p, user, numeric(form, "id"), value(form, "revision"), {
      contactConsent: form.get("contactConsent") === "on",
      ...(file instanceof File && file.size ? { wechatQr: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` } : {}),
    });
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
  const message = "名片及展示设置已更新。";
  revalidatePath("/community/apply");
  return { ok: true, message, successHref: "/community/apply?message=" + encodeURIComponent(message) + "#my-applications" };
}
export async function replaceShowcaseVideoResultAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  if (!user || user.accountStatus === "suspended") return { ok: false, message: "请重新登录后再保存，已选择的视频保留。" };
  const id = numeric(form, "id");
  let uploaded = "", game = 0;
  try {
    await workflowTransaction(p, user, { webShowcaseWrite: true }, async req => {
      const post = await p.findByID({ collection: "community-showcase", id, req, overrideAccess: false, depth: 0 });
      game = Number(post.game);
      if (!canReviewShowcase(req.user, post.game)) throw new APIError("无权修改此社群风采视频", 403);
      if (value(form, "revision") !== post.updatedAt) throw new APIError("风采已更新，请刷新后再上传", 409);
      const file = form.get("video");
      if (!(file instanceof File) || !file.size) throw new APIError("请选择 10 MB 以内的 MP4 视频", 400);
      uploaded = await saveVideo(file);
      await p.update({ collection: "community-showcase", id, req, overrideAccess: false, data: { videoURL: uploaded } });
    });
  } catch (error) {
    if (uploaded) await discardVideo(uploaded);
    return { ok: false, message: workflowFeedback(error) };
  }
  const path = `${await gamePath(game)}/showcase/${id}`;
  const message = "本站视频已更新，已升推内容会同步更新。";
  revalidatePath(path);
  revalidatePath(`${await gamePath(game)}/showcase`);
  return { ok: true, message, successHref: path + "?message=" + encodeURIComponent(message) };
}
