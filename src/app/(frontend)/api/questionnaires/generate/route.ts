import { cms } from "@/lib/content";
import { canPublish, hasRole } from "@/lib/rules";
import {
  boundedText,
  generateQuestionnaire,
  generationRequest,
  questionnaireAIModel,
  QuestionnaireAIError,
  reserveGeneration,
} from "@/lib/questionnaire-ai";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function run(request: Request) {
  try {
    const p = await cms(),
      { user } = await p.auth({ headers: request.headers });
    if (!user) return reply({ error: "请先登录。" }, 401);
    if (!canPublish(user) && !hasRole(user, "communityAdmin"))
      return reply({ error: "仅问卷管理者可使用 AI 制作。" }, 403);
    if (request.method === "GET")
      return reply({
        enabled: Boolean(process.env.QUESTIONNAIRE_AI_API_KEY),
        model: questionnaireAIModel,
      });
    const origin = request.headers.get("origin"),
      server =
        process.env.SERVER_URL ||
        process.env.NEXT_PUBLIC_SERVER_URL ||
        request.url;
    if (!origin || origin !== new URL(server).origin)
      return reply({ error: "请从网站问卷编辑器发起制作。" }, 403);
    if (
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length")) > 16000
    )
      return reply({ error: "制作请求格式或长度无效。" }, 400);
    let raw;
    try {
      raw = JSON.parse(await boundedText(request, 16000));
    } catch {
      return reply({ error: "制作请求格式或长度无效。" }, 400);
    }
    const input = generationRequest(raw);
    if (!process.env.QUESTIONNAIRE_AI_API_KEY)
      return reply({ error: "AI 制作尚未开通，请先使用模板或手动制作。" }, 503);
    const release = await reserveGeneration(user.id);
    try {
      return reply({
        form: await generateQuestionnaire(input, request.signal),
        model: questionnaireAIModel,
      });
    } finally {
      release();
    }
  } catch (e) {
    return reply(
      {
        error:
          e instanceof QuestionnaireAIError
            ? e.message
            : "AI 制作暂时无法完成，请稍后重试。",
      },
      e instanceof QuestionnaireAIError ? e.status : 503,
    );
  }
}
export const GET = run;
export const POST = run;
