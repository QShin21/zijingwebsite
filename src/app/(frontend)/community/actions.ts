"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { canPublish, hasRole, managesGame } from "@/lib/rules";
import { discardVideo, saveVideo, VIDEO_MAX_BYTES, SUBMISSION_MAX_BYTES } from '@/lib/showcase-videos';
import { applicationError } from "@/lib/application-error";

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
  const game = numeric(form, "game");
  const image = form.get("wechatQr");
  if (!(image instanceof File) || !image.size || image.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(image.type))
    return { error: "请上传 2 MB 以内的 PNG、JPEG 或 WebP 微信名片二维码。" };
  try {
    await p.create({ collection: "community-applications", overrideAccess: false, user,
      data: { game: game || undefined, proposedGame: value(form, "proposedGame"),
        realName: value(form, "realName"), phone: value(form, "phone"),
        wechatQr: `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`,
        reason: value(form, "reason"), status: "pending", applicant: user.id } });
  } catch (error) { return { error: applicationError(error) }; }
  return { success: true };
}
export async function decideAction(form: FormData) {
  const { p, user } = await current();
  if (!canPublish(user)) redirect("/account");
  const status = value(form, "decision");
  if (!["approved", "rejected"].includes(status)) problem("/community/review", "决定无效");
  try {
    await p.update({ collection: "community-applications", id: numeric(form, "id"),
      overrideAccess: false, user, data: { status: status as "approved" | "rejected" } });
  } catch { problem("/community/review", "审核未完成，申请可能已经处理"); }
  redirect("/community/review?done=1");
}
export async function publishCommunityAction(form: FormData) {
  const { p, user } = await current();
  const game = numeric(form, "game");
  const kind = value(form, "kind");
  const path = `${await gamePath(game)}/updates`;
  if (!["event", "notice"].includes(kind)) problem(path, "发布类型无效");
  try {
    await p.create({ collection: "community-posts", overrideAccess: false, user,
      data: { game, author: user.id, title: value(form, "title"), body: value(form, "body"), category: kind as "event" | "notice" } });
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
  if (!managesGame(user, game) || !hasRole(user, "president", "vicePresident", "communityAdmin"))
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
    await p.create({ collection: "community-showcase", overrideAccess: false, user, context: { webShowcaseWrite: true },
      data: { game: numeric(form, "game"), author: user.id, title: value(form, "title"), body: value(form, "body"), videoURL: uploaded || value(form, "videoURL"), images } });
    return { success: true };
  } catch (error) { if (uploaded) await discardVideo(uploaded); return { error: applicationError(error) }; }
}
export async function reviewShowcaseAction(form: FormData) {
  const { p, user } = await current();
  const post = await p.findByID({ collection: "community-showcase", id: numeric(form, "id"), overrideAccess: false, user, depth: 0 }).catch(() => null);
  if (!post || !managesGame(user, post.game)) redirect("/community");
  const path = `${await gamePath(Number(post.game))}/showcase`;
  const status = value(form, "status");
  if (!["visible", "rejected", "hidden"].includes(status)) problem(path, "审核决定无效");
  try { await p.update({ collection: "community-showcase", id: post.id, overrideAccess: false, user, context: { webShowcaseWrite: true },
    data: { status: status as "visible" | "rejected" | "hidden", reviewNote: value(form, "reviewNote") } }); }
  catch { problem(path, "审核未成功，请刷新后重试"); }
  redirect(`${path}?view=review&message=${encodeURIComponent("审核已保存")}`);
}
