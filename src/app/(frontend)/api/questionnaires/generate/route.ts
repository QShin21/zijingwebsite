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
import type {
  GenerationEvent,
  GenerationProgress,
  GenerationRequest,
} from "@/lib/questionnaire-ai-contract";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
const safeError = (e: unknown) =>
  e instanceof QuestionnaireAIError
    ? e.message
    : "AI 制作暂时无法完成，请稍后重试。";
function streamedGeneration(
  input: GenerationRequest,
  request: Request,
  release: () => void,
) {
  const abort = new AbortController();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let status: GenerationProgress = {
        stage: "generating",
        message: "正在准备制作…",
      };
      const send = (event: GenerationEvent) => {
        if (!closed)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const progress = (next: GenerationProgress) => {
        status = next;
        send({ type: "progress", ...next });
      };
      progress(status);
      const heartbeat = setInterval(
        () => send({ type: "progress", ...status }),
        8000,
      );
      void (async () => {
        try {
          const form = await generateQuestionnaire(
            input,
            AbortSignal.any([abort.signal, request.signal]),
            progress,
          );
          send({ type: "result", form, model: questionnaireAIModel });
        } catch (e) {
          send({ type: "error", error: safeError(e) });
        } finally {
          clearInterval(heartbeat);
          release();
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      closed = true;
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
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
      Number(request.headers.get("content-length")) > 224000
    )
      return reply({ error: "制作请求格式或长度无效。" }, 400);
    let raw;
    try {
      raw = JSON.parse(await boundedText(request, 224000));
    } catch {
      return reply({ error: "制作请求格式或长度无效。" }, 400);
    }
    const input = generationRequest(raw);
    if (!process.env.QUESTIONNAIRE_AI_API_KEY)
      return reply({ error: "AI 制作尚未开通，请先使用模板或手动制作。" }, 503);
    const release = await reserveGeneration(user.id);
    if (request.headers.get("accept")?.includes("application/x-ndjson"))
      return streamedGeneration(input, request, release);
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
        error: safeError(e),
      },
      e instanceof QuestionnaireAIError ? e.status : 503,
    );
  }
}
export const GET = run;
export const POST = run;
