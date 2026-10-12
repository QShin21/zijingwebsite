import { cms } from "@/lib/content";
import { teamHonorHTTP } from "@/lib/team-honor-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = async (request: Request) =>
  teamHonorHTTP(await cms(), request);
export const POST = async (request: Request) =>
  teamHonorHTTP(await cms(), request);
