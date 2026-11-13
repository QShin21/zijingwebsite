import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import { APIError, createLocalReq, type Payload } from "payload";
import type { User } from "../../payload-types";
import type { ImageRef } from "./types";
import { canUseCampus, canPublish, canReviewShowcase, communityIDs, relationID } from "../rules";
import { getActiveTeamMembership, getTeamMembershipByID } from "../team-memberships";
import { teamHonorService } from "../team-honor-service";
import { refreshViewer, requireViewer } from "./identity";
import { publicationAsset, publicationImages } from "../publication-images";

export type ControlledImageKind = "showcase" | "community-post" | "event-post" | "announcement-post" | "profile" | "contact" | "honor" | "upload";
const kinds = new Set<string>(["showcase", "community-post", "event-post", "announcement-post", "profile", "contact", "honor", "upload"]);
const missing = () => new APIError("图片不可访问", 404);
const positiveID = (value: unknown) => {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
};

/** Only raster storage is accepted. Never reflect the data URL's claimed MIME type. */
function storedImage(source: unknown) {
  if (typeof source !== "string" || source.length > 6_000_000 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(source)) return null;
  const bytes = Buffer.from(source.slice(source.indexOf(",") + 1), "base64");
  let type: string | null = null;
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) type = "image/png";
  else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) type = "image/jpeg";
  else if (bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") type = "image/webp";
  if (!type) return null;
  return { bytes, type, version: createHash("sha256").update(bytes).digest("hex").slice(0, 16) };
}

/** A synchronous projection helper; storage bytes and data URLs never leave the server. */
export function controlledImageRef(
  kind: ControlledImageKind,
  id: number,
  index: number,
  source: unknown,
  alt = "",
  dimensions?: { width?: number | null; height?: number | null },
): ImageRef | null {
  const asset = typeof source === "string" ? publicationAsset(source) : null;
  if (asset && positiveID(id) && Number.isSafeInteger(index) && index >= 0 && kinds.has(kind))
    return { src: `/api/v2/images/${kind}/${id}/${index}?v=${asset.version}`, width: dimensions?.width ?? null, height: dimensions?.height ?? null, alt };
  const image = storedImage(source);
  if (!image || !positiveID(id) || !Number.isSafeInteger(index) || index < 0 || !kinds.has(kind)) return null;
  return {
    src: `/api/v2/images/${kind}/${id}/${index}?v=${image.version}`,
    width: dimensions?.width ?? null, height: dimensions?.height ?? null, alt,
  };
}

/** Resolve an attached asset only after the owning record has passed access checks. */
export async function publicationAssetData(p: Payload, source: unknown) {
  const asset = typeof source === "string" ? publicationAsset(source) : null;
  if (!asset) return typeof source === "string" ? source : null;
  const upload = await p.findByID({ collection: "pending-uploads", id: asset.id, overrideAccess: true, depth: 0,
    select: { purpose: true, data: true, consumedAt: true } }).catch(() => null);
  const image = upload?.purpose === "publication" && upload.consumedAt ? storedImage(upload.data) : null;
  return image?.version === asset.version ? upload!.data : null;
}

async function publicGame(p: Payload, id: unknown) {
  const gameID = positiveID(relationID(id));
  if (!gameID) return null;
  const game = await p.findByID({
    collection: "games", id: gameID, user: null, overrideAccess: false, draft: false, depth: 0,
    select: { _status: true, demo: true },
  }).catch(() => null);
  return game?._status === "published" && !(process.env.APP_ENV === "production" && game.demo) ? game : null;
}

async function contactSource(p: Payload, viewer: User | null, communityID: number, userID: number) {
  if (!canUseCampus(viewer) || !positiveID(userID) || !await publicGame(p, communityID)) return null;
  const options = { user: null, overrideAccess: false as const, depth: 0, context: { publicCommunityContacts: communityID } };
  const user = await p.findByID({ collection: "users", id: userID, ...options,
    select: { communityOffices: true } }).catch(() => null);
  if (!user || !communityIDs(user, "contactConsent").includes(String(communityID))) return null;
  const rows = await p.find({
    collection: "community-applications", ...options, pagination: false, sort: "-createdAt",
    where: { applicant: { equals: userID } }, select: { wechatQr: true },
  });
  return rows.docs.find(row => row.wechatQr)?.wechatQr ?? null;
}

async function profileSource(p: Payload, viewer: User | null, id: number, index: number) {
  if (index !== 0) return null;
  // Internal locator only. Bytes are subsequently read with the existing scoped,
  // consent- and membership-period-aware collection access, never with override.
  const locator = await p.findByID({ collection: "team-member-profiles", id,
    overrideAccess: true, depth: 0, select: { membership: true } }).catch(() => null);
  const membershipID = positiveID(locator?.membership);
  if (!membershipID) return null;
  const membership = await getTeamMembershipByID(p, { membershipID });
  if (!membership) return null;
  const active = await getActiveTeamMembership(p, { teamID: membership.teamID, userID: membership.userID });
  if (!active || active.id !== membershipID) return null;
  const own = canUseCampus(viewer) && viewer!.id === active.userID;
  const req = await createLocalReq({ context: own
    ? { teamProfileOwn: membershipID }
    : { teamProfilePublic: [active] } }, p);
  req.user = own ? { ...viewer!, collection: "users" } : null;
  const profile = await p.findByID({ collection: "team-member-profiles", id, req,
    user: req.user, overrideAccess: false, depth: 0, select: { avatar: true } }).catch(() => null);
  return profile?.avatar ?? null;
}

async function imageSource(p: Payload, viewer: User | null, kind: ControlledImageKind, id: number, index: number) {
  if (kind === "contact") return contactSource(p, viewer, id, index);
  if (kind === "profile") return canUseCampus(viewer) ? profileSource(p, viewer, id, index) : null;
  if (kind === "honor") return canUseCampus(viewer) ? (await teamHonorService.publicRecord(p, id))?.images[index]?.source ?? null : null;
  if (kind === "upload") {
    if (!viewer || !canUseCampus(viewer) || index !== 0) return null;
    const fields = { data: true, owner: true, purpose: true, expiresAt: true, consumedAt: true } as const;
    const own = await p.findByID({ collection: "pending-uploads", id, user: viewer,
      overrideAccess: false, depth: 0, select: fields }).catch(() => null);
    const upload = own || (canPublish(viewer) ? await p.findByID({ collection: "pending-uploads", id, user: viewer,
      overrideAccess: true, depth: 0, select: fields }).catch(() => null) : null);
    const allowed = upload && (Number(relationID(upload.owner)) === viewer.id || upload.purpose === "publication" && canPublish(viewer));
    return allowed && (!upload.consumedAt && Date.parse(upload.expiresAt) > Date.now() || upload.purpose === "publication" && upload.consumedAt)
      ? upload.data : null;
  }
  if (kind === "event-post" || kind === "announcement-post") {
    const row = await p.findByID({ collection: kind === "event-post" ? "events" : "announcements", id,
      overrideAccess: false, user: viewer, depth: 0, draft: false,
      select: { postImages: true, _status: true, demo: true } }).catch(() => null);
    if (!row || row._status !== "published" || process.env.APP_ENV === "production" && row.demo) return null;
    return publicationAssetData(p, publicationImages(row.postImages)[index]?.source);
  }
  if (kind === "community-post") {
    const row = await p.findByID({ collection: "community-posts", id, overrideAccess: false, user: viewer, depth: 0,
      select: { postImages: true, game: true, status: true } }).catch(() => null);
    if (!row || !await publicGame(p, row.game) || row.status !== "visible" && !canUseCampus(viewer)) return null;
    const images = "postImages" in row ? row.postImages : null;
    return publicationAssetData(p, publicationImages(images)[index]?.source);
  }
  if (!canUseCampus(viewer)) return null;
  const row = await p.findByID({ collection: "community-showcase", id, overrideAccess: false, user: viewer, depth: 0,
    select: { images: true, status: true, game: true, author: true } }).catch(() => null);
  if (!row || !await publicGame(p, row.game) || !(row.status === "visible" || viewer &&
    (Number(relationID(row.author)) === viewer.id || canReviewShowcase(viewer, row.game) || canPublish(viewer)))) return null;
  return row.images?.[index]?.source ?? null;
}

const ticketLifetime = 60_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const imagePath = (kind: string, id: number, index: number, version: string) =>
  `/api/v2/images/${kind}/${id}/${index}?v=${version}`;
// Separate cryptographic domain from Payload login JWTs and other application tokens.
function ticketMAC(p: Payload, encoded: string) {
  if (typeof p.secret !== "string" || p.secret.length < 32) throw new APIError("图片服务暂时不可用", 503);
  return createHmac("sha256", p.secret).update("zijing:v2:image-ticket:1\0").update(encoded).digest();
}
type ImageTicket = { v: 1; u: number; a: string; s: string; r: string; e: number };

/** Only inspect the identified account's hidden session metadata; never return it. */
async function sessionExpiry(p: Payload, userID: number, sessionHash: string) {
  const user = await p.findByID({ collection: "users", id: userID, overrideAccess: true, depth: 0,
    showHiddenFields: true, select: { sessions: true } }).catch((error: unknown) => {
    if (error && typeof error === "object" && "status" in error && [403, 404].includes(Number(error.status))) return null;
    throw new APIError("暂时无法读取账号，请稍后重试", 503);
  });
  const session = user?.sessions?.find(session => digest(session.id) === sessionHash);
  const expiry = session ? Date.parse(session.expiresAt) : NaN;
  return Number.isFinite(expiry) && expiry > Date.now() ? expiry : null;
}

/** Authenticated batch minting, never accepts arbitrary URLs, user IDs or expiry values.
 * A ticket is a short-lived bearer credential for ONE image, not a login token.
 * The native client must keep it in memory, clear it on account changes and never log it.
 */
export async function signImages(p: Payload, viewer: User | null, input: { sources: unknown }) {
  const actor = await requireViewer(p, viewer);
  if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 20)
    throw new APIError("请一次请求 1–20 张图片", 400);
  const sources = [...new Set(input.sources)];
  const refs = sources.map(src => {
    const match = typeof src === "string" && src.length < 200
      ? /^\/api\/v2\/images\/([a-z-]+)\/([1-9]\d*)\/(0|[1-9]\d*)\?v=([a-f0-9]{16})$/.exec(src) : null;
    if (!match || !kinds.has(match[1]) || !positiveID(match[2]) || Number(match[3]) > 2147483647)
      throw new APIError("图片地址无效", 400);
    return { src: src as string, kind: match[1] as ControlledImageKind, id: Number(match[2]), index: Number(match[3]), version: match[4] };
  });
  // Payload sets _sid only after verifying its JWT and its session. A caller without
  // a session uses the existing authenticated image endpoint, never a weaker ticket.
  const sid = (viewer as (User & { _sid?: unknown }) | null)?._sid;
  if (typeof sid !== "string" || !sid || !actor.updatedAt) throw new APIError("请重新登录后读取图片", 401);
  const sessionHash = digest(sid), expiry = await sessionExpiry(p, actor.id, sessionHash);
  if (!expiry) throw new APIError("请重新登录后读取图片", 401);
  const expires = Math.min(Date.now() + ticketLifetime, expiry), expiresAt = new Date(expires).toISOString();
  // Sequential authorization bounds decoded image memory to one object at a time.
  const images: { src: string; url: string; expiresAt: string }[] = [];
  for (const ref of refs) {
    const image = storedImage(await imageSource(p, actor, ref.kind, ref.id, ref.index));
    if (!image || image.version !== ref.version) throw missing();
    const ticket: ImageTicket = { v: 1, u: actor.id, a: digest(actor.updatedAt), s: sessionHash, r: digest(ref.src), e: expires };
    const encoded = Buffer.from(JSON.stringify(ticket)).toString("base64url");
    images.push({ src: ref.src, url: `${ref.src}&ticket=${encoded}.${ticketMAC(p, encoded).toString("base64url")}`, expiresAt });
  }
  return { images, expiresAt };
}

async function ticketActor(p: Payload, viewer: User | null, token: string, path: string): Promise<User> {
  if (token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw missing();
  const [encoded, signature] = token.split(".");
  const actual = Buffer.from(signature, "base64url"), expected = ticketMAC(p, encoded);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw missing();
  let ticket: ImageTicket;
  try { ticket = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw missing(); }
  const now = Date.now();
  if (!ticket || ticket.v !== 1 || !positiveID(ticket.u) || !Number.isSafeInteger(ticket.e) || ticket.e <= now ||
    ticket.e > now + ticketLifetime || ticket.r !== digest(path) ||
    typeof ticket.a !== "string" || !/^[a-f0-9]{64}$/.test(ticket.a) || typeof ticket.s !== "string" || !/^[a-f0-9]{64}$/.test(ticket.s) ||
    viewer && viewer.id !== ticket.u) throw missing();
  const actor = await refreshViewer(p, { id: ticket.u } as User);
  if (!actor || !actor.updatedAt || digest(actor.updatedAt) !== ticket.a || !await sessionExpiry(p, actor.id, ticket.s)) throw missing();
  return actor;
}

/** Authorization always runs before conditional caching, including every 304. */
export async function getImage(
  p: Payload,
  viewer: User | null,
  input: { kind: string; id: unknown; index: unknown; version?: string | null; ifNoneMatch?: string | null; ticket?: string | null },
): Promise<Response> {
  const id = positiveID(input.id);
  const index = typeof input.index === "number" || typeof input.index === "string" && /^\d+$/.test(input.index) ? Number(input.index) : -1;
  if (!id || !Number.isSafeInteger(index) || index < 0 || index > 2147483647 || !kinds.has(input.kind)) throw missing();
  const actor = input.ticket != null
    ? await ticketActor(p, viewer, input.ticket, imagePath(input.kind, id, index, input.version ?? ""))
    : await refreshViewer(p, viewer);
  const source = await imageSource(p, actor, input.kind as ControlledImageKind, id, index);
  const image = storedImage(source);
  if (!image || input.ticket != null && image.version !== input.version) throw missing();
  const metadata = await sharp(image.bytes, { limitInputPixels: 40_000_000 }).metadata().catch(() => null);
  if (!metadata || !["png", "jpeg", "webp"].includes(metadata.format ?? "")) throw missing();
  const etag = `"${image.version}"`;
  const headers = {
    "Content-Type": image.type, "ETag": etag, "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "Vary": "Cookie, Authorization",
  };
  if (input.ifNoneMatch?.split(",").some(value => value.trim().replace(/^W\//, "") === etag || value.trim() === "*"))
    return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(image.bytes), { headers: { ...headers, "Content-Length": String(image.bytes.length) } });
}
