import { cms } from "@/lib/content";
import { teamHonorHTTP } from "@/lib/team-honor-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const run = async (request: Request, context: Context) =>
  teamHonorHTTP(await cms(), request, (await context.params).id);
export const GET = run;
export const POST = run;
export const PATCH = run;
