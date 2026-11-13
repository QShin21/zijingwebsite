import { APIError, type Payload } from "payload";
import type { TeamHonorRecord, User } from "../payload-types";
import { serverURL } from "./environment";
import { canUseCampus, canReviewShowcase, relationID } from "./rules";
import { teamHonorService } from "./team-honor-service";
import { honorError, honorWorkspace, saveHonorForm } from "./team-honor-web";
import { honorID, type HonorAction, type HonorInput } from "./team-honor-model";
import { miniappTeamHonorReads } from "./miniapp-team-honor";

const noStore = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: noStore });
const nativeToken = (request: Request) =>
  /^JWT [A-Za-z0-9._-]+$/.test(request.headers.get("authorization") || "");
export function honorMutationHeaders(request: Request): Headers {
  const origin = request.headers.get("origin"),
    expected = new URL(serverURL).origin;
  if (origin && origin !== expected)
    throw new APIError("请求来源无效，请从网站或小程序重新操作", 403);
  const token = nativeToken(request);
  if (!token && origin !== expected)
    throw new APIError(
      "浏览器写入需要同源 Origin，小程序写入需要有效 JWT 凭据",
      403,
    );
  const headers = new Headers(request.headers);
  // A native request must authenticate its explicit token; ambient cookies cannot replace an invalid token.
  if (token) headers.delete("cookie");
  return headers;
}
async function boundedBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum)
    throw new APIError("请求内容过长", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new APIError("请求正文为空", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new APIError("请求内容过长", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new APIError("请求对象格式无效", 400);
  return value as Record<string, unknown>;
}
function only(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new APIError("请求含不允许的身份、状态或字段", 400);
}
export function honorPrivateDTO(record: TeamHonorRecord, actor: User) {
  return {
    id: record.id,
    revision: record.revision,
    state: record.state,
    team: Number(relationID(record.team)),
    game: Number(relationID(record.game)),
    season: record.season ? Number(relationID(record.season)) : null,
    title: record.title,
    authorName: record.authorName,
    competition: record.competition || "",
    placing: record.placing || "",
    date: record.date || null,
    description: record.description || "",
    images: record.images || [],
    videoHref: record.videoURL
      ? "/api/team-honor-evidence/" +
        record.id +
        "/video?revision=" +
        record.revision
      : null,
    submittedVersion: record.submittedVersion || null,
    reviewNote: record.reviewNote || null,
    canReview:
      actor.id !== Number(relationID(record.author)) &&
      canReviewShowcase(actor, record.game),
  };
}
export async function teamHonorHTTP(
  p: Payload,
  request: Request,
  idValue?: unknown,
): Promise<Response> {
  try {
    const mutate = request.method !== "GET";
    if (!["GET", "POST", "PATCH"].includes(request.method))
      return reply({ error: "方法不支持" }, 405);
    const authHeaders = mutate
      ? honorMutationHeaders(request)
      : new Headers(request.headers);
    if (nativeToken(request)) authHeaders.delete("cookie");
    const { user } = await p.auth({ headers: authHeaders });
    if (!canUseCampus(user)) throw new APIError("请登录可用账号", 401);
    const actor = user!,
      id = idValue === undefined ? undefined : honorID(idValue);
    if (!mutate) {
      if (id) {
        const read = await miniappTeamHonorReads(p, actor);
        const record = await p.findByID({
          collection: "team-honor-records",
          id,
          user: read.actor,
          overrideAccess: false,
          depth: 0,
        });
        return reply({ record: { ...honorPrivateDTO(record, read.actor), actions: await read.recordActions(record) } });
      }
      const url = new URL(request.url),
        view = url.searchParams.get("view") === "review" ? "review" : "mine";
      const page = Math.max(
        1,
        Math.min(100000, Math.floor(Number(url.searchParams.get("page")) || 1)),
      );
      const scope = {
        ...(url.searchParams.get("team")
          ? { team: honorID(url.searchParams.get("team")) }
          : {}),
        ...(url.searchParams.get("game")
          ? { game: honorID(url.searchParams.get("game")) }
          : {}),
      };
      const read = await miniappTeamHonorReads(p, actor, scope),
        records = await honorWorkspace(p, read.actor, view, page, scope);
      return reply({
        docs: await Promise.all(records.docs.map(async (record) => ({ ...honorPrivateDTO(record, read.actor), actions: await read.recordActions(record) }))),
        totalDocs: records.totalDocs,
        page: records.page,
        totalPages: records.totalPages,
        teams: read.teams.map((row) => ({
          id: row.team,
          title: row.teamInfo.title,
          game: row.teamInfo.game,
          gameTitle: row.teamInfo.gameTitle,
          gameSlug: row.teamInfo.gameSlug,
        })),
        actions: read.actions,
      });
    }
    const type = request.headers.get("content-type") || "";
    let saved: TeamHonorRecord;
    if (type.startsWith("multipart/form-data")) {
      const bytes = await boundedBody(request, 14 * 1024 * 1024);
      const form = await new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: bytes,
      }).formData();
      for (const key of form.keys())
        if (
          ![
            "id",
            "revision",
            "action",
            "team",
            "season",
            "title",
            "competition",
            "placing",
            "date",
            "description",
            "pictures",
            "video",
            "removeVideo",
          ].includes(key) &&
          !/^(?:caption|removeImage|newCaption)-[0-5]$/.test(key)
        )
          throw new APIError("请求含不允许的字段", 400);
      if (id) form.set("id", String(id));
      else if (form.get("id")) throw new APIError("新增记录不能带已有 ID", 400);
      saved = await saveHonorForm(p, actor, form);
    } else if (type.startsWith("application/json")) {
      const bytes = await boundedBody(request, 17 * 1024 * 1024);
      let data: Record<string, unknown>;
      try {
        data = object(JSON.parse(bytes.toString("utf8")));
      } catch {
        throw new APIError("JSON 请求格式无效", 400);
      }
      only(data, ["action", "revision", "submittedVersion", "note", "input"]);
      const action = data.action as HonorAction;
      if (!id && !["save", "submit"].includes(action))
        throw new APIError("新增只支持 save/submit", 400);
      let input: HonorInput | undefined;
      if (["save", "submit"].includes(action)) {
        const raw = object(data.input ?? {});
        only(raw, [
          "team",
          "season",
          "title",
          "competition",
          "placing",
          "date",
          "description",
          "images",
          "removeVideo",
        ]);
        for (const key of ["title", "competition", "placing", "description"])
          if (raw[key] !== undefined && typeof raw[key] !== "string")
            throw new APIError("文本字段格式无效", 400);
        if (
          raw.removeVideo !== undefined &&
          typeof raw.removeVideo !== "boolean"
        )
          throw new APIError("视频移除标记无效", 400);
        if (raw.images !== undefined) {
          if (!Array.isArray(raw.images) || raw.images.length > 6)
            throw new APIError("证据图片格式无效", 400);
          let size = 0;
          for (const image of raw.images) {
            const value = object(image);
            only(value, ["source", "caption"]);
            if (
              typeof value.source !== "string" ||
              typeof value.caption !== "string"
            )
              throw new APIError("图片与说明格式无效", 400);
            size += Buffer.byteLength(
              value.source.split(",")[1] || "",
              "base64",
            );
          }
          if (size > 12 * 1024 * 1024)
            throw new APIError("证据图片总共最多 12 MB", 400);
        }
        const { removeVideo, ...allowed } = raw;
        input = allowed as HonorInput;
        if (removeVideo === true) input.videoURL = null;
      } else if (data.input !== undefined)
        throw new APIError("审核或撤回不能携带改稿内容", 400);
      saved = await teamHonorService.change(p, actor, action, {
        id,
        revision: data.revision,
        submittedVersion: data.submittedVersion,
        note: data.note,
        input,
      });
    } else throw new APIError("请使用 JSON 或 multipart/form-data", 415);
    return reply({ record: honorPrivateDTO(saved, actor) }, id ? 200 : 201);
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number" &&
      error.status >= 400 &&
      error.status <= 503
        ? error.status
        : 500;
    return reply({ error: honorError(error) }, status);
  }
}
