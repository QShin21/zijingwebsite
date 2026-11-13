import { APIError } from "payload";
import { canReviewActivitySeats, seatActivity, seatTicketList, uploadSeatTicket } from "@/lib/activity-seating";
import { seatingHTTP, seatingTicketUpload, seatReply, type SeatRouteContext } from "@/lib/activity-seating-http";
import { canParticipate } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) =>
    seatReply(await seatTicketList(p, await seatActivity(p, kind, id, user), user)));
}

export function POST(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    if (!canParticipate(user)) throw new APIError("请先登录可用账号", 401);
    const activity = await seatActivity(p, kind, id, user);
    if (!canReviewActivitySeats(user, activity.game)) throw new APIError("无权管理此活动的座位票据", 403);
    const { file, filename } = await seatingTicketUpload(request);
    return seatReply(await uploadSeatTicket(p, activity, user, file, filename), 201);
  });
}
