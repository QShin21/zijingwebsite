import {
  queryResponses,
  responseCSV,
  summarizeResponses,
} from "@/lib/questionnaire-results";
import { cms } from "@/lib/content";
import {
  activity,
  activityId,
  activityKind,
  ownSignup,
  saveSignupForm,
  signupState,
  submitSignup,
  updateSignupAnswers,
} from "@/lib/activity-signups";
import { applicationError } from "@/lib/application-error";
import { publicationImageRevision } from "@/lib/publication-image-storage";
import { publicationImageRequestBytes } from "@/lib/publication-images";
import { lotteryReceipt, readLottery } from "@/lib/activity-signup-lottery";
import { boundedBody } from "@/lib/site-request";
import { publicationAssetData } from "@/lib/v2/images";
import type { PublicationImage } from "@/lib/publication-images";
import { APIError, type Payload } from "payload";
import {
  responseExportFilename,
  responseExportLayout,
} from "@/lib/questionnaire-export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ kind: string; id: string }> };
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function withImagePreviews(p: Payload, images: PublicationImage[]) {
  return Promise.all(images.map(async image => ({ ...image, preview: await publicationAssetData(p, image.source) ?? "" })));
}
async function run(
  request: Request,
  context: Context,
  method: "GET" | "POST" | "PUT" | "PATCH",
) {
  try {
    const params = await context.params,
      kind = activityKind(params.kind),
      id = activityId(params.id);
    const p = await cms(),
      { user } = await p.auth({ headers: request.headers });
    const url = new URL(request.url),
      mode = url.searchParams.get("mode");
    const includeImages = request.headers.get("x-questionnaire-images") === "1";
    if (method === "GET") {
      const value = await activity(
        p,
        kind,
        id,
        user,
        ["manage", "view", "entries", "stats", "export"].includes(mode || ""),
        undefined, mode === "export" ? "export" : ["view", "entries", "stats"].includes(mode || "") ? "view" : "edit",
        includeImages && (!mode || mode === "manage"),
      );
      if (
        request.headers.get("authorization")?.startsWith("JWT ") &&
        !["2", "3"].includes(request.headers.get("x-questionnaire-version") || "") &&
        value.form.questions.some(
          (q) =>
            !["text", "textarea", "single", "multiple"].includes(q.type) ||
            Boolean(q.jumps?.length || q.display || q.showWhen),
        )
      )
        return reply(
          {
            error:
              "本问卷包含新版题型，请在网站 home.thuzijing.top 的活动详情中填写或管理。",
          },
          409,
        );
      if (mode === "stats" || mode === "export") {
        const records = await queryResponses(
          p,
          kind,
          id,
          user,
          url.searchParams,
          mode === "export",
        );
        if (mode === "export") {
          const lottery = await readLottery(p, kind, id);
          const lotteryExport = url.searchParams.get("lottery") === "1";
          if (lotteryExport && !lottery) throw new APIError("当前活动尚未抽签，请抽签后导出结果", 400);
          const candidates = new Set(lottery?.candidates), winners = new Set(lottery?.winners);
          const exportRecords = lottery ? records.map(record => ({
            ...record,
            lotteryStatus: !candidates.has(record.id) ? "未参与本次抽签" : winners.has(record.id) ? "已中签" : "未中签",
          })) : records;
          await p.create({ collection: "audit", overrideAccess: true, data: { actor: String(user!.id), action: "export-signups", object: `${kind}:${id}`, status: "authorized" } });
          const layout = lotteryExport ? "responses" : responseExportLayout(url.searchParams.get("layout"));
          const filename = responseExportFilename(value.doc.title, lotteryExport ? "lottery" : layout);
          return new Response(
            responseCSV(exportRecords, value.form.questions, layout, { includeLotteryStatus: Boolean(lottery) }),
            {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="questionnaire-${layout}.csv"; filename*=UTF-8''${encodeURIComponent(filename).replaceAll("'", "%27")}`,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
              },
            },
          );
        }
        return reply({
          total: records.length,
          groups: summarizeResponses(records),
        });
      }
      if (mode === "entries") {
        const page = Math.max(
          1,
          Math.min(
            100000,
            Math.floor(Number(url.searchParams.get("page")) || 1),
          ),
        );
        const records = await p.find({
          collection: "event-signups",
          overrideAccess: false,
          user,
          depth: 0,
          page,
          limit: 20,
          sort: "-createdAt",
          where: {
            and: [
              { activityType: { equals: kind } },
              { activityID: { equals: id } },
            ],
          },
          select: {
            memberName: true,
            answers: true,
            questions: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        const lottery = await readLottery(p, kind, id);
        return reply({
          docs: records.docs.map(record => lotteryReceipt(record, lottery)),
          totalDocs: records.totalDocs,
          page: records.page,
          totalPages: records.totalPages,
        });
      }
      const signup = await ownSignup(p, kind, id, user);
      const lottery = signup ? await readLottery(p, kind, id) : null;
      return reply({
        ...(includeImages && mode === "manage"
          ? { images: await withImagePreviews(p, value.images), imageRevision: publicationImageRevision(value.images) }
          : includeImages && !mode && value.form.enabled
            ? { images: await withImagePreviews(p, value.images.filter(({ questionId }) =>
                !questionId || value.form.questions.some(({ id }) => id === questionId),
              )) }
            : {}),
        title: value.doc.title,
        form: value.form,
        version: value.version,
        state: signupState(value.form, value.doc),
        canManage: value.manager,
        canViewSignups: value.canView,
        canExportSignups: value.canExport,
        loggedIn: Boolean(user),
        draftKey: user
          ? `questionnaire:${kind}:${id}:${user.id}:${value.version}`
          : undefined,
        signup: signup ? lotteryReceipt(signup, lottery) : null,
      });
    }
    const editImages = method === "PUT" && includeImages;
    if (editImages && !user) return reply({ error: "请先登录可用账号" }, 401);
    const limit = editImages ? publicationImageRequestBytes : 1024 * 1024;
    if (
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length")) > limit
    )
      return reply({ error: "请求格式不正确或内容过长" }, 400);
    const raw = (await boundedBody(request, limit)).toString("utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply({ error: "请求格式不正确" }, 400);
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      return reply({ error: "请求格式不正确" }, 400);
    if (method === "PUT") {
      const saved = await saveSignupForm(p, kind, id, user, data.version, data.form,
          editImages ? { revision: data.imageRevision, images: data.images } : undefined,
        );
      return reply(saved.images ? { ...saved, images: await withImagePreviews(p, saved.images) } : saved);
    }
    if (method === "PATCH" || (method === "POST" && data.action === "edit")) {
      const signup = await updateSignupAnswers(p, kind, id, user, data.version, data.revision, data.answers);
      return reply({
        signup: lotteryReceipt(signup, await readLottery(p, kind, id)),
        message: "作答修改已保存",
      });
    }
    const signup = await submitSignup(p, kind, id, user, data.version, data.answers);
    return reply({
      signup: lotteryReceipt(signup, await readLottery(p, kind, id)),
      message: "报名成功，已确认报名",
    });
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number" &&
      error.status >= 400 &&
      error.status < 500
        ? error.status
        : 500;
    return reply({ error: applicationError(error) }, status);
  }
}
export const GET = (r: Request, c: Context) => run(r, c, "GET");
export const POST = (r: Request, c: Context) => run(r, c, "POST");
export const PUT = (r: Request, c: Context) => run(r, c, "PUT");
export const PATCH = (r: Request, c: Context) => run(r, c, "PATCH");
