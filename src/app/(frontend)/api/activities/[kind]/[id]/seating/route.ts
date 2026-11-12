
import { cancelPendingSeats, decideSeats, editPendingSeats, revokeConfirmedSeat, revokeConfirmedSeats, seatActivity, seatingState, seatingWorkbench, setSeatBlocks, setSeating, submitSeats } from "@/lib/activity-seating";
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
    seatingFields(data, ["enabled", "opensAt"]);
    return seatReply(await setSeating(p, await seatActivity(p, kind, id, user), user, data.enabled, data.opensAt));
  });
}

export function POST(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const data = await seatingJSON(request);
    if (data.action === "review") {
      seatingFields(data, ["action", "id", "status", "revision"]);
      return seatReply(await decideSeats(p, await seatActivity(p, kind, id, user), user, data.id, data.status, data.revision));
    }
    if (data.action === "block") {
      seatingFields(data, ["action", "seats", "blocked"]);
      return seatReply(await setSeatBlocks(p, await seatActivity(p, kind, id, user), user, data.seats, data.blocked));
    }
    if (data.action === "revoke") {
      seatingFields(data, ["action", "id", "revision"]);
      const mine = await revokeConfirmedSeats(p, await seatActivity(p, kind, id, user), user, data.id, data.revision);
      return seatReply({ request: mine });
    }
    if (data.action === "revoke-seat") {
      seatingFields(data, ["action", "id", "revision", "seat"]);
      return seatReply(await revokeConfirmedSeat(p, await seatActivity(p, kind, id, user), user, data.id, data.revision, data.seat));
    }
    if (data.action === "edit") {
      seatingFields(data, ["action", "id", "revision", "seats", "phone", "proofs"]);
      const mine = await editPendingSeats(p, await seatActivity(p, kind, id, user), user, data);
      return seatReply({ mine });
    }
    seatingFields(data, ["seats", "phone", "proofs"]);
    const mine = await submitSeats(p, await seatActivity(p, kind, id, user), user, data);
    return seatReply({ mine });
  });
}

export function PATCH(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const data = await seatingJSON(request);
    seatingFields(data, ["id", "revision", "seats", "phone", "proofs"]);
    const mine = await editPendingSeats(p, await seatActivity(p, kind, id, user), user, data);
    return seatReply({ mine });
  });
}

export function DELETE(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const data = await seatingJSON(request);
    seatingFields(data, ["id", "revision"]);
    const mine = await cancelPendingSeats(p, await seatActivity(p, kind, id, user), user, data.id, data.revision);
    return seatReply({ mine });
  });
}
