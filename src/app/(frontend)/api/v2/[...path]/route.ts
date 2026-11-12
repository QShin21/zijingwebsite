import { cms } from "@/lib/content";
import { v2Request } from "@/lib/v2/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function run(request: Request, context: Context) {
  // Infrastructure failures use the same private, non-diagnostic response as the
  // dispatcher. Never expose connection details to API consumers.
  try { return await v2Request(await cms(), request, (await context.params).path); }
  catch { return Response.json({ error: "服务暂时不可用，请稍后重试", code: "UNAVAILABLE" }, { status: 503,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", Vary: "Cookie, Authorization" } }); }
}
export const GET = run;
export const POST = run;
