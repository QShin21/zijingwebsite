import { drawLottery, lotteryWorkbench } from "@/lib/activity-signup-lottery";
import { seatingFields, seatingHTTP, seatingJSON, seatReply, type SeatRouteContext } from "@/lib/activity-seating-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) =>
    seatReply(await lotteryWorkbench(p, kind, id, user)));
}

export function POST(request: Request, context: SeatRouteContext) {
  return seatingHTTP(request, context, async (p, kind, id, user) => {
    const data = await seatingJSON(request);
    seatingFields(data, ["count", "expectedTotal", "revision"]);
    return seatReply(await drawLottery(p, kind, id, user, data.count, data.expectedTotal, data.revision));
  });
}
