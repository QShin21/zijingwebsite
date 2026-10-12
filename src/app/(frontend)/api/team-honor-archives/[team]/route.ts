import { cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ team: string }> },
) {
  const { team } = await context.params,
    headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
  if (
    !/^\d+$/.test(team) ||
    !Number.isSafeInteger(Number(team)) ||
    Number(team) <= 0
  )
    return Response.json({ error: "档案不存在" }, { status: 404, headers });
  const archive = (
    await teamHonorService.archives(await cms(), { team: Number(team) })
  )[0];
  if (!archive)
    return Response.json({ error: "档案不存在" }, { status: 404, headers });
  // The archive DTO intentionally contains no pending materials, membership/author IDs or audit/review details.
  return Response.json(archive, { headers });
}
