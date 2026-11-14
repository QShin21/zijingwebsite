import { APIError } from "payload";
import { cms } from "@/lib/content";
import { applicationError } from "@/lib/application-error";
import { seatingJSON, seatReply } from "@/lib/activity-seating-http";
import { siteRequestHeaders } from "@/lib/site-request";
import { requireViewer } from "@/lib/v2/identity";
import { listQuizEvents, quizAction, quizEvent } from "@/lib/quiz-prizes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    const headers = siteRequestHeaders(request, request.method !== "GET");
    const payload = await cms();
    const { user } = await payload.auth({ headers });
    const actor = await requireViewer(payload, user);
    if (request.method === "GET") {
      const event = new URL(request.url).searchParams.get("event");
      return seatReply(event ? await quizEvent(actor, event) : await listQuizEvents(actor));
    }
    const data = await seatingJSON(request, 100_000);
    return seatReply(await quizAction(actor, data));
  } catch (error) {
    const status = error instanceof APIError && error.status >= 400 && error.status < 500 ? error.status : 500;
    return seatReply({ error: applicationError(error) }, status);
  }
}
export const GET = handle;
export const POST = handle;
