import { APIError, type Payload, type PayloadRequest, type Where } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import type { StaffApplication, StaffBatch, User } from "../payload-types";
import { canManageStaffRecruitment, relationID } from "./rules";
import { workflowTransaction } from "./workflow-transactions";
import { formVersion } from "./activity-signups";
import { visibleQuestions } from "./signup-schema";
import { defaultStaffForm, staffAnswers, staffForm, staffWindow } from "./staff-recruitment-model";
import { responseCSV, type ResponseRecord } from "./questionnaire-results";
import type { Answers, Question } from "./signup-schema";

type History = { action: string; at: string; from: string; to: string; feedback: string };
const history = (row?: StaffApplication) => Array.isArray(row?.history) ? row.history as unknown as History[] : [];
async function database(req: PayloadRequest) {
  const db = req.payload.db as unknown as PostgresAdapter, id = await req.transactionID, session = id != null ? db.sessions[String(id)] : null;
  if (!session) throw new APIError("无法安全保存，请刷新重试", 503);
  return session.db;
}
async function batchLock(req: PayloadRequest, id: number, write = false) {
  const db = await database(req);
  await db.execute(write ? sql`SELECT id FROM staff_batches WHERE id=${id} FOR UPDATE` : sql`SELECT id FROM staff_batches WHERE id=${id} FOR SHARE`);
}
function checkedID(id: number) { if (!Number.isSafeInteger(id) || id <= 0) throw new APIError("批次或申请不存在", 404); }
export async function publicStaffBatch(p: Payload, id: number) {
  checkedID(id);
  return p.findByID({ collection: "staff-batches", id, overrideAccess: false, user: null, depth: 0,
    select: { title: true, description: true, state: true, startAt: true, endAt: true, signupForm: true, updatedAt: true } });
}
export async function saveStaffBatch(p: Payload, actor: User | null, id: number | null, revision: unknown,
  value: { title: unknown; description?: unknown; state: unknown; startAt?: unknown; endAt?: unknown; signupForm?: unknown }) {
  return workflowTransaction(p, actor, { staffBatchWrite: true }, async req => {
    if (!canManageStaffRecruitment(req.user)) throw new APIError("仅社长/副社长可管理骨干招新", 403);
    const db = await database(req);
    await db.execute(sql`SELECT pg_advisory_xact_lock(742611021)`);
    if (id) { checkedID(id); await batchLock(req, id, true); }
    const current = id ? await p.findByID({ collection: "staff-batches", id, req, overrideAccess: false, depth: 0 }) : null;
    if (current && revision !== current.updatedAt) throw new APIError("批次已更新，请刷新后核对", 409);
    const title = String(value.title ?? "").trim(), description = String(value.description ?? "").trim(), state = String(value.state);
    if (!title || title.length > 120 || description.length > 5000 || !["draft", "open", "closed"].includes(state)) throw new APIError("请核对批次标题、说明和状态", 400);
    const date = (input: unknown) => {
      if (!input) return null;
      const stamp = Date.parse(String(input)); if (!Number.isFinite(stamp)) throw new APIError("批次时间无效", 400);
      return new Date(stamp).toISOString();
    };
    const startAt = date(value.startAt), endAt = date(value.endAt);
    if ((startAt && endAt && startAt >= endAt) || (state === "open" && (!endAt || Date.parse(endAt) <= Date.now()))) throw new APIError("发布需提供未来截止时间，开始时间须早于截止", 400);
    let form;
    try { form = staffForm(value.signupForm ?? current?.signupForm ?? defaultStaffForm); } catch (error) { throw new APIError((error as Error).message, 400); }
    if (state === "open") {
      const other = (await p.find({ collection: "staff-batches", req, overrideAccess: false, depth: 0, limit: 1,
        where: { and: [{ currentKey: { equals: "staff" } }, ...(id ? [{ id: { not_equals: id } }] : [])] } })).docs[0];
      if (other) {
        if (["申请开放", "申请尚未开始"].includes(staffWindow(other))) throw new APIError("已有当前骨干招新，请先关闭该批次", 409);
        await p.update({ collection: "staff-batches", id: other.id, req, overrideAccess: false, data: { state: "closed", currentKey: null } });
        await p.create({ collection: "audit", req, overrideAccess: true, data: { actor: String(req.user!.id), object: "staff-batches:" + other.id, action: "deadline-close", status: "closed" } });
      }
    }
    const data = { title, description, state: state as StaffBatch["state"], startAt, endAt, signupForm: form, currentKey: state === "open" ? "staff" : null };
    const saved = current ? await p.update({ collection: "staff-batches", id: current.id, req, overrideAccess: false, data })
      : await p.create({ collection: "staff-batches", req, overrideAccess: false, data });
    await p.create({ collection: "audit", req, overrideAccess: true, data: { actor: String(req.user!.id), object: "staff-batches:" + saved.id, action: (current?.state ?? "new") + "->" + saved.state, status: saved.state } });
    return saved;
  });
}
export async function changeStaffApplication(p: Payload, actor: User | null, batchID: number, action: "submit" | "edit" | "withdraw" | "review",
  options: { id?: number; revision?: unknown; version?: unknown; answers?: unknown; status?: unknown; feedback?: unknown; reviewNotes?: unknown } = {}) {
  checkedID(batchID);
  return workflowTransaction(p, actor, { staffApplicationWrite: true }, async req => {
    const user = req.user as User;
    if (action === "review" && !canManageStaffRecruitment(user)) throw new APIError("无权审核骨干候选资料", 403);
    await batchLock(req, batchID);
    const batch = await p.findByID({ collection: "staff-batches", id: batchID, req, overrideAccess: false, depth: 0 });
    if (batch.state === "draft" && action !== "review") throw new APIError("批次尚未发布", 404);
    const key = batchID + ":" + user.id, db = await database(req);
    if (action === "review") {
      checkedID(options.id ?? 0);
      await db.execute(sql`SELECT id FROM staff_applications WHERE id=${options.id!} FOR UPDATE`);
    } else await db.execute(sql`SELECT id FROM staff_applications WHERE request_key=${key} FOR UPDATE`);
    const current = action === "review" ? await p.findByID({ collection: "staff-applications", id: options.id!, req, overrideAccess: false, depth: 0 })
      : (await p.find({ collection: "staff-applications", req, overrideAccess: false, limit: 1, depth: 0, where: { requestKey: { equals: key } } })).docs[0];
    if (current && Number(relationID(current.batch)) !== batchID) throw new APIError("申请与批次不匹配", 409);
    if (action === "submit" && current && current.status !== "withdrawn") return current;
    if (current && options.revision !== current.updatedAt) throw new APIError("申请已更新，请刷新后核对", 409);
    const data: Partial<StaffApplication> = {};
    if (action === "review") {
      if (!current || current.status === "withdrawn") throw new APIError("已撤回申请不可处理", 409);
      const status = String(options.status), feedback = String(options.feedback ?? "").trim(), notes = String(options.reviewNotes ?? "").trim();
      if (!["reviewing", "returned", "accepted", "rejected"].includes(status) || feedback.length > 1000 || notes.length > 3000 || (["returned", "rejected"].includes(status) && !feedback)) throw new APIError("请填写有效决定；退回或未录用须说明原因", 400);
      Object.assign(data, { status, feedback, reviewNotes: notes });
    } else {
      const window = staffWindow(batch);
      if (window !== "申请开放") throw new APIError(window + "，当前只能查看回执", 409);
      if (current && ["accepted", "rejected"].includes(current.status)) throw new APIError("已有最终结果，仅可查看；请由管理层明确退回补充", 409);
      if (action === "withdraw") {
        if (!current || current.status === "withdrawn") throw new APIError("没有可撤回的申请", 409);
        data.status = "withdrawn";
      } else {
        if (action === "edit" && !current) throw new APIError("请先提交申请", 404);
        const form = staffForm(batch.signupForm), version = formVersion(form);
        if (options.version !== version) throw new APIError("问卷已更新，请刷新后填写", 409);
        let clean; try { clean = staffAnswers(form, options.answers); } catch (error) { throw new APIError((error as Error).message, 400); }
        Object.assign(data, { status: "submitted", department: clean.department, formVersion: version, questions: visibleQuestions(form, clean.answers), answers: clean.answers, feedback: null });
      }
    }
    const entry: History = { action, at: new Date().toISOString(), from: current?.status ?? "new", to: data.status!, feedback: data.feedback ?? "" };
    data.history = [...history(current), entry];
    const saved = current ? await p.update({ collection: "staff-applications", id: current.id, req, overrideAccess: false, data })
      : await p.create({ collection: "staff-applications", req, overrideAccess: false, data: { ...data, batch: batchID, applicant: user.id, requestKey: key, memberName: user.name, batchTitle: batch.title, department: data.department!, status: data.status!, formVersion: data.formVersion!, questions: data.questions!, answers: data.answers! } });
    await p.create({ collection: "audit", req, overrideAccess: true, data: { actor: String(user.id), object: "staff-applications:" + saved.id, action: action + ":" + entry.from + "->" + entry.to, status: saved.status } });
    return saved;
  });
}
export async function currentStaffBatches(p: Payload) {
  const result = await p.find({ collection: "staff-batches", user: null, overrideAccess: false, depth: 0, limit: 1, sort: "-createdAt",
    where: { currentKey: { equals: "staff" } }, select: { title: true, description: true, state: true, startAt: true, endAt: true, signupForm: true } });
  return result.docs;
}
export async function ownStaffApplication(p: Payload, actor: User | null, batchID: number) {
  if (!actor) return null;
  return (await p.find({ collection: "staff-applications", user: actor, overrideAccess: false, limit: 1, depth: 0,
    where: { requestKey: { equals: batchID + ":" + actor.id } } })).docs[0] ?? null;
}
export async function ownStaffReceiptHeaders(p: Payload, actor: User | null, batchID?: number, page = 1) {
  if (!actor) return null;
  if (batchID !== undefined) checkedID(batchID);
  return p.find({ collection: "staff-applications", user: actor, overrideAccess: false, depth: 0, limit: batchID ? 1 : 20,
    page, sort: "-updatedAt", where: { and: [{ applicant: { equals: actor.id } }, ...(batchID ? [{ batch: { equals: batchID } }] : [])] },
    select: { batch: true, batchTitle: true, status: true, updatedAt: true } });
}
export async function readStaffApplications(p: Payload, actor: User | null, batchID: number, query: URLSearchParams, exportCSV = false) {
  checkedID(batchID);
  return workflowTransaction(p, actor, {}, async req => {
    if (!canManageStaffRecruitment(req.user)) throw new APIError("无权读取或导出骨干候选资料", 403);
    const batch = await p.findByID({ collection: "staff-batches", id: batchID, req, overrideAccess: false, depth: 0 });
    const department = query.get("department"), status = query.get("status");
    if ((department && !["execution", "publicity", "both"].includes(department)) || (status && !["submitted", "reviewing", "returned", "accepted", "rejected", "withdrawn"].includes(status))) throw new APIError("筛选条件无效", 400);
    const where: Where = { and: [{ batch: { equals: batchID } }, ...(department ? [{ department: { equals: department } }] : []), ...(status ? [{ status: { equals: status } }] : [])] };
    const result = await p.find({ collection: "staff-applications", req, overrideAccess: false, depth: 0, where, sort: "-updatedAt",
      limit: exportCSV ? 10001 : 20, pagination: !exportCSV, page: Math.max(1, Math.min(10000, Number(query.get("page")) || 1)) });
    if (!exportCSV) return { batch, result };
    if (result.docs.length > 10000 || new TextEncoder().encode(JSON.stringify(result.docs)).length > 16 * 1024 * 1024) throw new APIError("导出超过限制，请按批次、方向或状态筛选", 413);
    const records: ResponseRecord[] = result.docs.map(row => ({ id: row.id, memberName: row.memberName, createdAt: row.createdAt, updatedAt: row.updatedAt,
      formVersion: row.formVersion, questions: row.questions as unknown as Question[], answers: row.answers as unknown as Answers }));
    const csv = responseCSV(records, staffForm(batch.signupForm).questions);
    await p.create({ collection: "audit", req, overrideAccess: true, data: { actor: String(req.user!.id), object: "staff-batches:" + batchID, action: "export-staff-applications", status: "authorized" } });
    return { batch, result, csv };
  });
}
