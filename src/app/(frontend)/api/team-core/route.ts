import { cms } from "@/lib/content";
import { APIError } from "payload";
import { canParticipate } from "@/lib/rules";
import { currentTeamActor, requireTeamManager } from "@/lib/team-memberships";
import { applicationError } from "@/lib/application-error";
import {
  submitTeamEstablishment,
  withdrawTeamEstablishment,
  decideTeamEstablishment,
  changeTeamLifecycle,
  saveTeamRecruitment,
  closeTeamRecruitment,
  teamRecruitmentInfo,
  saveTeamJoinApplication,
  withdrawTeamJoinApplication,
  decideTeamJoinApplication,
  revokeTeamMembership,
  teamJoinReceipt,
  teamID,
} from "@/lib/team-core";
import { serverURL } from "@/lib/environment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
export async function GET(request: Request) {
  try {
    const p = await cms(),
      { user } = await p.auth({ headers: request.headers });
    if (!canParticipate(await currentTeamActor(p, user)))
      throw new APIError("请先登录可用账号", 401);
    const query = new URL(request.url).searchParams;
    if (query.get("mode") === "recruitment") {
      const info = await teamRecruitmentInfo(p, user, teamID(query.get("id")));
      return reply({
        title: info.doc.title,
        teamID: Number(info.doc.team),
        state: info.state,
        readOnly: info.readOnly,
        form: info.form,
        version: info.version,
        application: teamJoinReceipt(info.own),
      });
    }
    if (query.get("mode") === "applications") {
      const id = teamID(query.get("team"));
      await requireTeamManager(p, user, id);
      const page = Math.max(
        1,
        Math.min(10000, Math.floor(Number(query.get("page")) || 1)),
      );
      const result = await p.find({
        collection: "team-join-applications",
        user,
        overrideAccess: false,
        depth: 0,
        page,
        limit: 20,
        sort: "createdAt",
        where: {
          and: [
            { team: { equals: id } },
            {
              status: {
                in: [
                  "pending",
                  "returned",
                  "approved",
                  "rejected",
                  "withdrawn",
                ],
              },
            },
          ],
        },
      });
      return reply({
        docs: result.docs.map(teamJoinReceipt),
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
      });
    }
    throw new APIError("查询入口无效", 400);
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && ![serverURL, new URL(request.url).origin].includes(origin))
    )
      throw new APIError("请从本站提交操作", 403);
    if (
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length")) > 300000
    )
      throw new APIError("请求格式无效或内容过长", 400);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 300000) throw new APIError("内容过长", 400);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new APIError("请求格式无效", 400);
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new APIError("请求格式无效", 400);
    const p = await cms(),
      { user } = await p.auth({ headers: request.headers });
    if (!canParticipate(user)) throw new APIError("请先登录可用账号", 401);
    let result: unknown;
    switch (data.operation) {
      case "establish":
        result = await submitTeamEstablishment(p, user, {
          gameID: data.gameID,
          title: data.title,
          reason: data.reason,
          id: data.id,
          revision: data.revision,
        });
        break;
      case "withdraw-establishment":
        result = await withdrawTeamEstablishment(
          p,
          user,
          teamID(data.id),
          data.revision,
        );
        break;
      case "decide-establishment":
        result = await decideTeamEstablishment(
          p,
          user,
          teamID(data.id),
          data.decision,
          data.note,
          data.revision,
        );
        break;
      case "lifecycle":
        result = await changeTeamLifecycle(
          p,
          user,
          teamID(data.id),
          data.status,
          data.revision,
        );
        break;
      case "save-recruitment":
        result = await saveTeamRecruitment(p, user, {
          teamID: data.teamID,
          id: data.id,
          revision: data.revision,
          title: data.title,
          status: data.status,
          form: data.form,
        });
        break;
      case "close-recruitment":
        if (data.status !== "closed" && data.status !== "archived")
          throw new APIError("招新状态无效", 400);
        result = await closeTeamRecruitment(
          p,
          user,
          teamID(data.id),
          data.status,
          data.revision,
        );
        break;
      case "save-join":
        if (data.action !== "draft" && data.action !== "submit")
          throw new APIError("申请操作无效", 400);
        result = teamJoinReceipt(
          await saveTeamJoinApplication(p, user, teamID(data.id), {
            action: data.action,
            version: data.version,
            revision: data.revision,
            answers: data.answers,
          }),
        );
        break;
      case "withdraw-join":
        result = teamJoinReceipt(
          await withdrawTeamJoinApplication(
            p,
            user,
            teamID(data.id),
            data.revision,
          ),
        );
        break;
      case "decide-join":
        result = teamJoinReceipt(
          await decideTeamJoinApplication(
            p,
            user,
            teamID(data.id),
            data.decision,
            data.note,
            data.revision,
            data.seasonID,
          ),
        );
        break;
      case "revoke":
      case "leave":
        result = await revokeTeamMembership(
          p,
          user,
          teamID(data.id),
          data.revision,
          data.note,
          data.operation === "leave",
        );
        break;
      default:
        throw new APIError("代表队操作无效", 400);
    }
    return reply({ result, message: "操作已保存。" });
  } catch (error) {
    return failure(error);
  }
}
function failure(error: unknown) {
  const status =
    error instanceof APIError && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  return reply({ error: applicationError(error) }, status);
}
