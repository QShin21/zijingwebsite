import { saveSeatingLayout, seatActivity, seatingLayout } from "@/lib/activity-seating";
import { seatingFields, seatingHTTP, seatingJSON, seatReply, type SeatRouteContext } from "@/lib/activity-seating-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) =>
    seatReply(await seatingLayout(p, await seatActivity(p, kind, id, user), user)));
}

export function PUT(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const data = await seatingJSON(request, 128 * 1024);
    seatingFields(data, ["layout", "revision"]);
    return seatReply(await saveSeatingLayout(p, await seatActivity(p, kind, id, user), user, data.layout, data.revision));
  });
}
