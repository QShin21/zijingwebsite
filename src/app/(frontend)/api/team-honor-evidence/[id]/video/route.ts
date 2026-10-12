import { cms } from "@/lib/content";
import { honorVideoResponse } from "@/lib/team-honor-evidence";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function serve(
  request: Request,
  context: { params: Promise<{ id: string }> },
  head = false,
) {
  const p = await cms(),
    { user } = await p.auth({ headers: request.headers });
  return honorVideoResponse(p, user, (await context.params).id, request, head);
}
export const GET = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => serve(request, context);
export const HEAD = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => serve(request, context, true);
