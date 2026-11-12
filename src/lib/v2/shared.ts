import { APIError, type CollectionSlug, type Payload, type Where } from "payload";
import type { User } from "@/payload-types";
import { relationID, safeURL } from "../rules";
import { serverURL } from "../environment";
import type { CommunityRef, ImageRef, Page, TeamRef } from "./types";

export type Row = Record<string, unknown> & { id: number };
export type Input = Record<string, unknown>;
export const txt = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
export const rel = (value: unknown): number | null => {
  const key = relationID(value);
  if (typeof key !== "number" && !(typeof key === "string" && /^\d+$/.test(key))) return null;
  const n = Number(key);
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
};
export const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter(v => v && typeof v === "object") as Row[] : [];
export const iso = (value: unknown): string | null => txt(value) && Number.isFinite(Date.parse(String(value))) ? new Date(String(value)).toISOString() : null;
export function pageInput(input: Input = {}) {
  const integer = (v: unknown, fallback: number) => Number.isFinite(Number(v)) ? Math.max(1, Math.floor(Number(v))) : fallback;
  return { page: Math.min(10000, integer(input.page, 1)), limit: Math.min(50, integer(input.limit, 12)) };
}
export function paginate<T>(docs: T[], input: Input = {}): Page<T> {
  const { page, limit } = pageInput(input);
  return { docs: docs.slice((page - 1) * limit, page * limit), page, totalPages: Math.ceil(docs.length / limit), totalDocs: docs.length, hasNextPage: page * limit < docs.length };
}
export const selectFields = (fields: readonly string[]) => Object.fromEntries(fields.map(key => [key, true])) as Record<string, true>;
export const published: Where = { _status: { equals: "published" } };
export function publicWhere(where: Where = {}): Where {
  return { and: [published, ...(process.env.APP_ENV === "production" ? [{ demo: { not_equals: true } }] : []), where] };
}
export async function readRows(p: Payload, collection: CollectionSlug, fields: readonly string[], where: Where = {}, viewer: User | null = null, limit = 500, sort: string = "-createdAt"): Promise<Row[]> {
  const result = await p.find({ collection, overrideAccess: false, user: viewer, draft: false, depth: 0, limit, pagination: false, sort, where, select: selectFields(fields) });
  return result.docs as unknown as Row[];
}
export async function findRow(p: Payload, collection: CollectionSlug, idOrSlug: unknown, fields: readonly string[], viewer: User | null = null, where: Where = {}): Promise<Row | null> {
  const id = rel(idOrSlug);
  const match: Where = id ? { id: { equals: id } } : { slug: { equals: String(idOrSlug ?? "") } };
  return (await readRows(p, collection, fields, { and: [match, where] }, viewer, 1))[0] ?? null;
}
export async function communityRef(p: Payload, value: unknown): Promise<CommunityRef | null> {
  const id = rel(value);
  if (!id) return null;
  const row = await findRow(p, "games", id, ["title", "slug", "_status", "archived", "demo"], null, publicWhere());
  return row ? { id: row.id, slug: String(row.slug ?? ""), title: String(row.title ?? ""), hue: (row.id * 137) % 360 } : null;
}
export async function teamRef(p: Payload, value: unknown): Promise<TeamRef | null> {
  const id = rel(value);
  if (!id) return null;
  const row = await findRow(p, "teams", id, ["title", "slug", "game", "_status", "demo"], null, publicWhere());
  if (!row) return null;
  const community = await communityRef(p, row.game);
  if (rel(row.game) && !community) return null;
  return { id: row.id, slug: String(row.slug ?? ""), title: String(row.title ?? ""), community };
}
export async function mediaRef(p: Payload, value: unknown, alt = ""): Promise<ImageRef | null> {
  const id = rel(value);
  if (!id) return null;
  const media = await p.findByID({ collection: "media", id, overrideAccess: false, user: null, depth: 0, select: { url: true, filename: true, width: true, height: true, alt: true } }).catch(() => null);
  if (!media) return null;
  // Payload may return an absolute URL, including a historical host or S3 URL.
  // Keep existing bytes/metadata untouched and use its access-checked same-origin
  // file endpoint. The configured storage adapter serves that endpoint for S3 too.
  let src: string | null = null;
  if (typeof media.filename === "string" && media.filename) {
    if (!media.filename.startsWith(".") && !/[\\/\p{Cc}]/u.test(media.filename) && /\.(png|jpe?g|webp)$/i.test(media.filename))
      src = `/api/media/file/${encodeURIComponent(media.filename)}`;
  } else if (typeof media.url === "string") {
    try {
      const base = new URL(serverURL), url = new URL(media.url, base);
      if (url.origin === base.origin && !url.username && !url.password &&
        url.pathname.startsWith("/api/media/file/") && !media.url.includes("\\"))
        src = url.pathname + url.search;
    } catch { /* Invalid legacy metadata is not an image source. */ }
  }
  return src ? { src, width: typeof media.width === "number" ? media.width : null, height: typeof media.height === "number" ? media.height : null, alt: txt(media.alt) ?? alt } : null;
}
export function safeBody(value: unknown): unknown | null {
  if (!value || typeof value !== "object") return null;
  let count = 0;
  function valid(v: unknown, depth: number): boolean {
    if (++count > 20000 || depth > 50 || !v || typeof v !== "object") return false;
    const n = v as Record<string, unknown>;
    if (n.type != null && !["root", "paragraph", "text", "heading", "list", "listitem", "link", "autolink", "linebreak", "quote", "horizontalrule", "tab"].includes(String(n.type))) return false;
    if (["link", "autolink"].includes(String(n.type)) && !safeURL((n.fields as Record<string, unknown> | undefined)?.url)) return false;
    return (!n.root || valid(n.root, depth + 1)) && (!Array.isArray(n.children) || n.children.every(child => valid(child, depth + 1)));
  }
  return valid(value, 0) ? value : null;
}
export function plainBody(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const n = value as Record<string, unknown>;
  return [typeof n.text === "string" ? n.text : "", plainBody(n.root), ...(Array.isArray(n.children) ? n.children.map(plainBody) : [])].filter(Boolean).join(" ");
}
export function notFound(): never { throw new APIError("内容暂时不可访问", 404); }
export const beijingDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
