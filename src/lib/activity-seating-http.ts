
import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import { activityId, activityKind } from "./activity-signups";
import { cms } from "./content";
import { boundedBody, siteRequestHeaders } from "./site-request";
import { applicationError } from "./application-error";
import { seatProofBytes, seatTicketBytes, seatStatusLabels, type SeatStatus, type SeatingKind } from "./activity-seating-model";

export const seatResponseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Cookie, Authorization",
  "Referrer-Policy": "no-referrer",
};
export const seatReply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: seatResponseHeaders });

export type SeatRouteContext = { params: Promise<{ kind: string; id: string }> };

export async function seatingHTTP<T extends SeatRouteContext>(
  request: Request, context: T,
  handler: (p: Payload, kind: SeatingKind, id: number, user: User | null) => Promise<Response>,
) {
  try {
    const { kind, id } = await context.params;
    const activity = activityId(id);
    if (activity > 2147483647 || !/^[1-9]\d*$/.test(id)) throw new APIError("活动不存在", 404);
    const headers = siteRequestHeaders(request, !["GET", "HEAD"].includes(request.method));
    const p = await cms();
    const { user } = await p.auth({ headers });
    return await handler(p, activityKind(kind), activity, user);
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error &&
      typeof error.status === "number" && error.status >= 400 && error.status < 500 ? error.status : 500;
    return seatReply({ error: applicationError(error) }, status);
  }
}

export async function seatingJSON(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? ""))
    throw new APIError("请提交 JSON 请求", 415);
  const body = await boundedBody(request, 8192);
  try {
    const value: unknown = JSON.parse(body.toString("utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* Send a public validation error for malformed JSON. */ }
  throw new APIError("请求格式无效", 400);
}

export async function seatingUpload(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new APIError("请选择活动参与凭证图片", 415);
  const body = await boundedBody(request, seatProofBytes + 32 * 1024);
  const form = await new Request(request.url, { method: "POST", headers: request.headers, body }).formData()
    .catch(() => { throw new APIError("图片上传格式无效", 400); });
  const files = form.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File))
    throw new APIError("每次请上传一张图片", 400);
  return files[0];
}

export async function seatingTicketUpload(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new APIError("请选择 JPG 或 PNG 票据图片", 415);
  const body = await boundedBody(request, seatTicketBytes + 32 * 1024);
  const form = await new Request(request.url, { method: "POST", headers: request.headers, body }).formData()
    .catch(() => { throw new APIError("图片上传格式无效", 400); });
  const files = form.getAll("file");
  const names = form.getAll("filename");
  if (files.length !== 1 || !(files[0] instanceof File) || names.length > 1 || (names.length && typeof names[0] !== "string"))
    throw new APIError("每次请上传一张票据图片", 400);
  return { file: files[0], filename: names[0] as string | undefined ?? files[0].name };
}

export function seatingReviewFilter(query: URLSearchParams) {
  const status = query.get("status") || "pending";
  if (!Object.hasOwn(seatStatusLabels, status)) throw new APIError("审核状态无效", 400);
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.get("page"))) || 1));
  return { status: status as SeatStatus, page };
}

export function seatingFields(data: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(data).some(key => !allowed.includes(key)))
    throw new APIError("请求含不允许的身份、状态或字段", 400);
}
