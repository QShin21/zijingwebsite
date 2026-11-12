
import { APIError } from "payload";
import { seatActivity, uploadSeatProof } from "@/lib/activity-seating";
import { seatingHTTP, seatingUpload, seatReply, type SeatRouteContext } from "@/lib/activity-seating-http";
import { canParticipate } from "@/lib/rules";

export const runtime = "nodejs";

export function POST(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    if (!canParticipate(user)) throw new APIError("请先登录可用账号", 401);
    const activity = await seatActivity(p, kind, id, user);
    return seatReply(await uploadSeatProof(p, activity, user, await seatingUpload(request)), 201);
  });
}
