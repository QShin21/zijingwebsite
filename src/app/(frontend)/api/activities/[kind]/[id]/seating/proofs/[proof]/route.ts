
import { seatActivity, seatProof } from "@/lib/activity-seating";
import { seatingHTTP, seatReply, seatResponseHeaders } from "@/lib/activity-seating-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ kind: string; id: string; proof: string }> };

export function GET(request: Request, context: Context) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const activity = await seatActivity(p, kind, id, user);
    const bytes = await seatProof(p, activity, user, (await context.params).proof);
    return new Response(bytes ? new Uint8Array(bytes) : null, {
      headers: { ...seatResponseHeaders, "Content-Type": "image/webp", "Cross-Origin-Resource-Policy": "same-origin" },
    });
  });
}

export function DELETE(request: Request, context: Context) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    await seatProof(p, await seatActivity(p, kind, id, user), user, (await context.params).proof, true);
    return seatReply({ removed: true });
  });
}
