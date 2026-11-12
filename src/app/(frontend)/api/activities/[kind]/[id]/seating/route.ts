
import { decideSeats, seatActivity, seatingState, seatingWorkbench, setSeating, submitSeats } from "@/lib/activity-seating";
import { seatingHTTP, seatingJSON, seatingFields, seatingReviewFilter, seatReply, type SeatRouteContext } from "@/lib/activity-seating-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const query = new URL(request.url).searchParams;
    if (query.get("mode") === "review") {
      const activity = await seatActivity(p, kind, id, user);
      const { status, page } = seatingReviewFilter(query);
      return seatReply(await seatingWorkbench(p, activity, user, status, page));
    }
    return seatReply(await seatingState(p, await seatActivity(p, kind, id, user), user));
  });
}

export function PUT(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const data = await seatingJSON(request);
    seatingFields(data, ["enabled"]);
    return seatReply(await setSeating(p, await seatActivity(p, kind, id, user), user, data.enabled));
  });
}

export function POST(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const data = await seatingJSON(request);
    if (data.action === "review") {
      seatingFields(data, ["action", "id", "status"]);
      return seatReply(await decideSeats(p, await seatActivity(p, kind, id, user), user, data.id, data.status));
    }
    seatingFields(data, ["seats", "phone", "proofs"]);
    const mine = await submitSeats(p, await seatActivity(p, kind, id, user), user, data);
    return seatReply({ mine });
  });
}
