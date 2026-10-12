import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { serverURL } from "@/lib/environment";
import { readTeamProfiles, saveTeamProfile } from "@/lib/team-profiles";
import { profileError, teamProfileID } from "@/lib/team-profiles-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ teamID: string }> };
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

async function run(request: Request, context: Context, write: boolean) {
  try {
    const teamID = teamProfileID((await context.params).teamID);
    const p = await cms(),
      { user } = await p.auth({ headers: request.headers });
    if (!canParticipate(user))
      return reply({ error: "请登录后访问代表队简介" }, 401);
    if (!write) return reply(await readTeamProfiles(p, user, teamID));
    const origin = request.headers.get("origin"),
      fetchSite = request.headers.get("sec-fetch-site");
    if (
      (origin && origin !== new URL(serverURL).origin) ||
      (!origin && fetchSite !== "same-origin")
    )
      return reply({ error: "请从本站简介页面保存" }, 403);
    const max = 2_900_000;
    if (
      !/^application\/json(?:;|$)/i.test(
        request.headers.get("content-type") || "",
      ) ||
      Number(request.headers.get("content-length")) > max
    )
      return reply({ error: "请求格式无效或内容过长" }, 400);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "简介格式无效" }, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        return reply({ error: "简介内容过长" }, 400);
      }
      chunks.push(chunk.value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply({ error: "简介格式无效" }, 400);
    }
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      Object.keys(data).some(
        (key) => !["profile", "revision", "membershipVersion"].includes(key),
      )
    )
      return reply({ error: "简介请求仅接受资料和版本" }, 400);
    return reply({
      profile: await saveTeamProfile(
        p,
        user,
        teamID,
        data.revision,
        data.profile,
        data.membershipVersion,
      ),
    });
  } catch (cause) {
    const result = profileError(cause);
    return reply(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status,
    );
  }
}
export const GET = (request: Request, context: Context) =>
  run(request, context, false);
export const PUT = (request: Request, context: Context) =>
  run(request, context, true);
