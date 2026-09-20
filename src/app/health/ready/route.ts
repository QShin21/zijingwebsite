import { cms } from "@/lib/content";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await (
      await cms()
    ).count({ collection: "events", overrideAccess: false, user: null });
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
