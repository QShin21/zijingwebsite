import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import { serverURL } from "../environment";
import { refreshViewer } from "./identity";
import type { ErrorCode } from "./types";
import * as service from "./index";
import { signImages } from "./images";
import { publicationImageBytes } from "../publication-images";
import { requestLocale } from "../i18n/locale";
import { localizeView } from "../content-translation/localize";

const codes: Record<number, ErrorCode> = { 400: "VALIDATION", 401: "AUTH_REQUIRED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 413: "PAYLOAD_TOO_LARGE", 415: "UNSUPPORTED_MEDIA", 429: "RATE_LIMITED", 503: "UNAVAILABLE" };
const messages: Record<number, string> = { 400: "请求内容无效，请检查后重试", 401: "请先登录可用账号", 403: "无权进行此操作", 404: "内容暂时不可访问", 409: "内容已更新或已处理，请刷新后重试", 413: "请求内容过大", 415: "不支持此文件格式", 429: "操作过于频繁，请稍后重试", 503: "服务暂时不可用，请稍后重试" };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", Vary: "Cookie, Authorization, X-Zijing-Locale" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
// No SQL, stack traces or third-party diagnostics are reflected to clients.
function failure(error: unknown): Response {
  const status = error instanceof APIError && codes[error.status] ? error.status : 503;
  return reply({ error: messages[status], code: codes[status] }, status);
}
function id(value: string) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 2147483647)
    throw new APIError("内容不可访问", 404);
  return Number(value);
}
async function bytes(request: Request, max: number): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new APIError("请求内容过大", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new APIError("请求内容无效", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) { await reader.cancel(); throw new APIError("请求内容过大", 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return new Uint8Array(Buffer.concat(chunks));
}
async function json(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) throw new APIError("请求格式无效", 415);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await bytes(request, 100_000))); }
  catch (error) { if (error instanceof APIError) throw error; throw new APIError("请求内容无效", 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new APIError("请求内容无效", 400);
  return value as Record<string, unknown>;
}
function keys(data: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(data).some(key => !allowed.includes(key))) throw new APIError("请求包含不支持的字段", 400);
}
function writeOrigin(request: Request) {
  // JWT uses a separately verified header credential; a cookie-only caller must
  // prove the same-origin request just as legacy writing endpoints do.
  if (/^JWT\s+\S+$/i.test(request.headers.get("authorization") ?? "")) return;
  const origin = request.headers.get("origin");
  if (origin !== new URL(serverURL).origin && (origin || request.headers.get("sec-fetch-site") !== "same-origin"))
    throw new APIError("请从本站操作", 403);
}

export async function v2Request(p: Payload, request: Request, path: string[]): Promise<Response> {
  try {
    if (path.length > 5 || path.some(part => !part || part.length > 200 || /[\\/\0]/.test(part))) throw new APIError("接口不存在", 404);
    if (request.method === "POST") writeOrigin(request);
    const authHeaders = new Headers(request.headers);
    if (/^JWT\s+\S+$/i.test(authHeaders.get("authorization") ?? "")) authHeaders.delete("cookie");
    const { user } = await p.auth({ headers: authHeaders });
    const viewer = user as User | null;
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const route = path.join("/");
    if (request.method === "GET") {
      // English readers get cached translations of text already in the authorized result.
      const locale = requestLocale(request);
      const view = async (value: unknown) => reply(await localizeView(value, locale));
      if (path[0] === "images" && path.length === 4) return await service.getImage(p, viewer, {
        kind: path[1], id: path[2], index: path[3], version: query.v, ticket: query.ticket, ifNoneMatch: request.headers.get("if-none-match"),
      });
      const reads = {
        session: service.getSession, home: service.getHome, calendar: service.getCalendar, feed: service.getFeed,
        communities: service.getCommunities, teams: service.getTeams, honors: service.getHonors,
        recruitment: service.getRecruitmentCenter, me: service.getMe, "me/signups": service.getMySignups,
        "me/applications": service.getMyApplications, "me/seat-requests": service.getMySeatReceipts, manage: service.getManage,
      };
      const read = Object.hasOwn(reads, route) ? reads[route as keyof typeof reads] : undefined;
      if (read) return view(await read(p, viewer, query));
      if (path[0] === "events" && path.length === 3 && ["club", "community"].includes(path[1]))
        return view(await service.getEventDetail(p, viewer, { ...query, source: path[1], idOrSlug: path[2] }));
      if (path[0] === "articles" && path.length === 3)
        return view(await service.getArticle(p, viewer, { ...query, kind: path[1], idOrSlug: path[2] }));
      if (path[0] === "communities" && path.length === 2)
        return view(await service.getCommunity(p, viewer, { ...query, slug: path[1] }));
      if (path[0] === "communities" && path.length === 3) {
        const reads = { header: service.getCommunityHeader, contacts: service.getContacts, showcase: service.getShowcase, posts: service.getCommunityPosts };
        const read = Object.hasOwn(reads, path[2]) ? reads[path[2] as keyof typeof reads] : undefined;
        if (read) return view(await read(p, viewer, { ...query, slug: path[1] }));
      }
      if (path[0] === "teams" && path.length === 2) return view(await service.getTeam(p, viewer, { ...query, slug: path[1] }));
      if (path[0] === "pages" && path.length === 2) return view(await service.getFixedPage(p, viewer, { key: path[1] }));
    } else if (request.method === "POST") {
      const actor = await refreshViewer(p, viewer);
      if (!actor) throw new APIError("请登录可用账号", viewer ? 403 : 401);
      if (route === "me/archive") {
        // Personal display preference only; the target must be the caller's own record.
        const data = await json(request); keys(data, ["target", "archived"]);
        return reply(await service.setArchive(p, actor, { target: data.target, archived: data.archived }));
      }
      if (route === "images/sign") {
        const data = await json(request); keys(data, ["sources"]);
        return reply(await signImages(p, viewer, { sources: data.sources }));
      }
      if (route === "uploads") {
        if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")) throw new APIError("上传格式无效", 415);
        const data = await new Request(request.url, { method: "POST", headers: request.headers,
          body: Buffer.from(await bytes(request, publicationImageBytes + 64 * 1024)) }).formData().catch(() => { throw new APIError("上传格式无效", 400); });
        if (data.getAll("file").length !== 1 || data.getAll("purpose").length !== 1 || [...data.keys()].some(key => !["file", "purpose"].includes(key)))
          throw new APIError("请一次上传一张图片", 400);
        return reply(await service.createUpload(p, actor, { file: data.get("file"), purpose: data.get("purpose") }), 201);
      }
      if (path[0] === "communities" && path.length === 3 && path[2] === "showcase") {
        const data = await json(request); keys(data, ["title", "body", "videoURL", "images"]);
        return reply(await service.createShowcase(p, actor, { slug: path[1], title: data.title, body: data.body, videoURL: data.videoURL, images: data.images ?? [] }), 201);
      }
      if (path[0] === "showcase" && path.length === 3 && path[2] === "review") {
        const record = id(path[1]), data = await json(request); keys(data, ["decision", "reviewNote", "revision"]);
        return reply(await service.reviewShowcase(p, actor, { id: record, decision: data.decision, reviewNote: data.reviewNote, revision: data.revision }));
      }
    }
    throw new APIError("接口不存在", 404);
  } catch (error) { return failure(error); }
}
