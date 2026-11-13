import { seatActivity, seatTicketImage } from "@/lib/activity-seating";
import { seatingHTTP, seatResponseHeaders } from "@/lib/activity-seating-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ kind: string; id: string; seat: string }> };

export function GET(request: Request, context: Context) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const seat = (await context.params).seat;
    const image = await seatTicketImage(p, await seatActivity(p, kind, id, user), user, seat);
    const extension = image.mime === "image/png" ? "png" : "jpg";
    return new Response(new Uint8Array(image.picture), { headers: {
      ...seatResponseHeaders, "Content-Type": image.mime,
      "Content-Disposition": `inline; filename="seat-${seat}.${extension}"`,
      "Cross-Origin-Resource-Policy": "same-origin",
    } });
  });
}
