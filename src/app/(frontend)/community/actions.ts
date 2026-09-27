"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { canPublish, hasRole, managesGame, routeFor } from "@/lib/rules";
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
  const where = await gamePath(game);
  if (!["forum", "message", "event", "notice"].includes(kind)) problem(where, "发布类型无效");
  let createdForum: number | null = null;
  try {
    if (kind === "forum") {
      const post = await p.create({ collection: "forum-posts", overrideAccess: false, user,
        data: { game, author: user.id, title: value(form, "title"), body: value(form, "body") } });
      createdForum = post.id;
    }
    if (kind === "message") await p.create({ collection: "community-messages",
      overrideAccess: false, user, data: { game, author: user.id, body: value(form, "body") } });
    if (kind === "event" || kind === "notice") await p.create({
      collection: "community-posts", overrideAccess: false, user,
      data: { game, author: user.id, title: value(form, "title"), body: value(form, "body"), category: kind },
    });
  } catch { problem(`${where}/${kind === "forum" ? "forum" : kind === "message" ? "chat" : "updates"}`, "发布未成功，请核对内容、权限或发言频率"); }
  if (createdForum) redirect(`${where}/forum/${createdForum}`);
  redirect(`${where}/${kind === "message" ? "chat" : "updates"}`);
}
export async function commentAction(form: FormData) {
  const { p, user } = await current();
  const targetType = value(form, "targetType");
  const targetId = numeric(form, "targetId");
  const collection = (["events", "albums", "news", "announcements", "forum-posts", "community-posts"] as const)
    .find((name) => name === targetType);
  if (!collection) redirect("/community");
  const target = await p.findByID({ collection, id: targetId, user: null,
    overrideAccess: false, draft: false, depth: 0 }).catch(() => null);
  if (!target) redirect("/community");
  const post = target as { id: number; game?: number | null; slug?: string | null };
  const path = collection === "forum-posts" ? `${await gamePath(Number(post.game))}/forum/${post.id}`
    : collection === "community-posts" ? `${await gamePath(Number(post.game))}/updates/${post.id}` : `/${routeFor[collection]}/${post.slug}`;
  try {
    await p.create({ collection: "comments", overrideAccess: false, user,
      data: { targetType: collection, targetId, author: user.id, body: value(form, "body"),
        parent: numeric(form, "parent") || undefined } });
  } catch { problem(path, "评论未成功，请检查内容或发言权限"); }
  redirect(path);
}
export async function moderateAction(form: FormData) {
  const { p, user } = await current();
  const collection = (["forum-posts", "community-messages", "community-posts", "comments"] as const)
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

export async function reactionAction(form: FormData) {
  const { p, user } = await current();
  const collection = value(form, "targetType") === "forum-posts" ? "forum-posts" : "community-posts";
  const id = numeric(form, "targetId");
  const kind = value(form, "kind") === "attend" ? "attend" : "like";
  const target = await p.findByID({ collection, id, overrideAccess: false, user: null, depth: 0 }).catch(() => null);
  if (!target) redirect("/community");
  const path = `${await gamePath(Number(target.game))}/${collection === "forum-posts" ? "forum" : "updates"}/${id}`;
  try {
    const existing = await p.find({ collection: "community-reactions", overrideAccess: false, user,
      context: { ownReactions: true }, where: { targetType: { equals: collection }, targetId: { equals: id }, kind: { equals: kind } }, depth: 0, limit: 1 });
    if (existing.docs[0]) await p.delete({ collection: "community-reactions", id: existing.docs[0].id, overrideAccess: false, user });
    else await p.create({ collection: "community-reactions", overrideAccess: false, user,
      data: { targetType: collection, targetId: id, kind, author: user.id, key: "server-derived" } });
  } catch { problem(path, "操作未成功，请稍后重试"); }
  redirect(path);
}

export async function curateForumAction(form: FormData) {
  const { p, user } = await current();
  const post = await p.findByID({ collection: "forum-posts", id: numeric(form, "id"), overrideAccess: false, user, depth: 0 }).catch(() => null);
  if (!post || !managesGame(user, post.game)) redirect("/community");
  const path = `${await gamePath(Number(post.game))}/forum`;
  const field = value(form, "field");
  if (!["pinned", "featured", "status"].includes(field)) problem(path, "管理操作无效");
  try { await p.update({ collection: "forum-posts", id: post.id, overrideAccess: false, user,
    data: field === "status" ? { status: "hidden" } : { [field]: value(form, "enabled") === "true" } }); }
  catch { problem(path, "管理操作未成功"); }
  redirect(path);
}
