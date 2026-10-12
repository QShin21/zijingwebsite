import { cms } from "@/lib/content";
import { changeStaffApplication, ownStaffApplication, publicStaffBatch, readStaffApplications } from "@/lib/staff-recruitment";
import { staffForm, staffWindow } from "@/lib/staff-recruitment-model";
import { formVersion } from "@/lib/activity-signups";
import { applicationError } from "@/lib/application-error";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
async function run(request: Request, context: Context, method: string) {
  try {
    const { id } = await context.params, batchID = Number(id), p = await cms(), { user } = await p.auth({ headers: request.headers });
    if (method === "GET") {
      const query = new URL(request.url).searchParams, mode = query.get("mode");
      if (mode === "review" || mode === "export") {
        const data = await readStaffApplications(p, user, batchID, query, mode === "export");
        if (mode === "export" && "csv" in data) return new Response(data.csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="staff-applications-' + batchID + '.csv"' } });
        return Response.json(data.result, { headers });
      }
      const own = await ownStaffApplication(p, user, batchID), batch = await publicStaffBatch(p, batchID).catch(() => null);
      if (!batch && !own) return Response.json({ error: "批次尚未发布或已移除" }, { status: 404, headers });
      if (!batch) return Response.json({ title: own!.batchTitle, form: null, version: own!.formVersion,
        state: "批次已撤下，仅可查看回执", loggedIn: Boolean(user), application: own }, { headers });
      const form = staffForm(batch.signupForm);
      const version = formVersion(form);
      return Response.json({ title: batch.title, form, version, state: staffWindow(batch),
        loggedIn: Boolean(user), draftKey: user ? "staff:" + batchID + ":" + user.id + ":" + version : undefined, application: own }, { headers });
    }
    const body = await request.json();
    const action = method === "PATCH" ? "edit" : body.action === "withdraw" ? "withdraw" : body.action === "review" ? "review" : "submit";
    const saved = await changeStaffApplication(p, user, batchID, action, { id: body.id, revision: body.revision, version: body.version, answers: body.answers,
      status: body.status, feedback: body.feedback, reviewNotes: body.reviewNotes });
    return Response.json({ application: saved }, { headers });
  } catch (error) {
    return Response.json({ error: applicationError(error) }, { status: error && typeof error === "object" && "status" in error ? Number(error.status) : 400, headers });
  }
}
export const GET = (request: Request, context: Context) => run(request, context, "GET");
export const POST = (request: Request, context: Context) => run(request, context, "POST");
export const PATCH = (request: Request, context: Context) => run(request, context, "PATCH");
