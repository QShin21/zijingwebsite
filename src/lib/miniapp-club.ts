import { APIError, type Payload } from "payload";
import type { CommunityApplication, CommunityJoin, StaffApplication, StaffBatch, User } from "../payload-types";
import { canHandleCommunityJoins, canManageStaffRecruitment, canParticipate, canReviewCommunityApplication, relationID } from "./rules";
import { currentStaffBatches, ownStaffApplication, publicStaffBatch, readStaffApplications } from "./staff-recruitment";
import { canReviewStaffTransition, staffDeadlinePolicy, staffForm, staffPrivacy, staffWindow } from "./staff-recruitment-model";
import { formVersion } from "./activity-signups";
import { promotedContent } from "./content-promotions";
import { changeCommunityJoin, decideCommunityApplication, editCommunityApplication, updateCommunityCard } from "./community-operations";

const applicationPath = "community/applications";
const staffPath = /^staff\/([^/]+)$/;
const joinPath = /^community\/([^/]+)\/join$/;
export const miniappClubReadPath = (path: string) => ["club", "staff", "workbench", applicationPath].includes(path) || staffPath.test(path) || joinPath.test(path);
export const miniappClubWritePath = (path: string) => path === applicationPath || joinPath.test(path);
const text = (value: unknown) => typeof value === "string" ? value : "";
function id(value: unknown) {
  const number = typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value)) ? Number(value) : 0;
  if (!Number.isSafeInteger(number) || number <= 0) throw new APIError("记录不存在", 404);
  return number;
}
const optionalID = (value: unknown) => value == null || value === "" ? undefined : id(value);
const pageNumber = (query: URLSearchParams) => Math.max(1, Math.min(10000, Math.floor(Number(query.get("page")) || 1)));
function pageResult<T>(result: { docs: T[]; page?: number; totalPages: number; totalDocs: number; hasNextPage: boolean }, docs: unknown[]) {
  return { docs, page: result.page ?? 1, totalPages: result.totalPages, totalDocs: result.totalDocs, hasNextPage: result.hasNextPage };
}

// JWT/cookie identities only identify the account. Current database permissions govern every private read and write.
async function currentUser(p: Payload, request: Request): Promise<User> {
  const { user } = await p.auth({ headers: request.headers });
  if (!user?.id) throw new APIError("请先登录可用账号", 401);
  const fresh = await p.findByID({ collection: "users", id: user.id, overrideAccess: true, depth: 0,
    select: { name: true, email: true, createdAt: true, updatedAt: true, roles: true, accountStatus: true, communityOffices: true } }).catch(() => null);
  if (!canParticipate(fresh)) throw new APIError("账号已停用或不可用，请联系负责人", 403);
  return { ...fresh!, collection: "users" };
}

const applicationSelect = { applicant: true, game: true, proposedGame: true, realName: true, phone: true, reason: true,
  contactConsent: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true, updatedAt: true } as const;
function applicationReceipt(row: CommunityApplication, user: User) {
  const own = Number(relationID(row.applicant)) === user.id;
  return { id: row.id, applicant: relationID(row.applicant), game: relationID(row.game) ?? null, proposedGame: row.proposedGame,
    realName: row.realName, phone: row.phone, reason: row.reason, contactConsent: row.contactConsent === true,
    status: row.status, reviewNote: row.reviewNote, reviewedAt: row.reviewedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
    // Visibility hints; collection hooks and the existing transactional services validate the submitted action again.
    actions: { edit: own && ["returned", "withdrawn"].includes(row.status ?? ""), withdraw: own && row.status === "pending",
      card: own && row.status === "approved", review: canReviewCommunityApplication(user) && row.status === "pending" } };
}
function staffReceipt(row: StaffApplication) {
  return { id: row.id, batch: relationID(row.batch), applicant: relationID(row.applicant), memberName: row.memberName,
    batchTitle: row.batchTitle, department: row.department, status: row.status, formVersion: row.formVersion,
    questions: row.questions, answers: row.answers, feedback: row.feedback, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
function staffBatchReceipt(batch: Pick<StaffBatch, "id" | "title" | "description" | "startAt" | "endAt" | "state" | "signupForm">) {
  return { id: batch.id, title: batch.title, description: batch.description, startAt: batch.startAt, endAt: batch.endAt, state: staffWindow(batch) };
}
const joinSelect = { member: true, game: true, contact: true, memberName: true, status: true, note: true, confirmedAt: true,
  createdAt: true, updatedAt: true } as const;
type JoinReceipt = Omit<CommunityJoin, "dedupeKey" | "confirmedBy">;
function joinReceipt(row: JoinReceipt) {
  return { id: row.id, member: relationID(row.member), game: relationID(row.game), contact: relationID(row.contact) ?? null,
    memberName: row.memberName, status: row.status, note: row.note, confirmedAt: row.confirmedAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
function joinActions(row: JoinReceipt | null, user: User) {
  const own = !row || Number(relationID(row.member)) === user.id;
  return { request: own && (!row || row.status === "withdrawn"),
    reportFriend: own && Boolean(row && ["requested", "friendReported"].includes(row.status)),
    withdraw: own && Boolean(row && !["joined", "withdrawn"].includes(row.status)) };
}
function handlingActions(row: JoinReceipt, user: User, gameID: number) {
  const canHandle = canHandleCommunityJoins(user, gameID);
  return { confirmFriend: canHandle && ["requested", "friendReported"].includes(row.status), confirmJoined: canHandle && row.status === "awaitingInvite" };
}

export async function miniappClubGET(p: Payload, request: Request, path: string) {
  if (path === "club") {
    const [batches, event, notice, showcase] = await Promise.all([currentStaffBatches(p), promotedContent(p, "event"), promotedContent(p, "notice"), promotedContent(p, "showcase")]);
    return { staffBatches: batches.map(staffBatchReceipt), promotions: { event, notice, showcase } };
  }
  if (path === "staff") {
    const result = await p.find({ collection: "staff-batches", overrideAccess: false, user: null, depth: 0, limit: 12,
      page: pageNumber(new URL(request.url).searchParams), sort: "-createdAt",
      select: { title: true, description: true, state: true, startAt: true, endAt: true, signupForm: true } });
    return pageResult(result, result.docs.map(staffBatchReceipt));
  }
  const user = await currentUser(p, request), query = new URL(request.url).searchParams;
  if (path === "workbench") return { reviewCommunity: canReviewCommunityApplication(user), reviewStaff: canManageStaffRecruitment(user) };
  const staff = staffPath.exec(path);
  if (staff) {
    const batchID = id(staff[1]);
    if (query.get("mode") === "review") {
      const { result } = await readStaffApplications(p, user, batchID, query);
      return pageResult(result, result.docs.map(row => ({ ...staffReceipt(row), actions: {
        reviewStatuses: ["reviewing", "returned", "accepted", "rejected"].filter(status => canReviewStaffTransition(row.status, status)) } })));
    }
    const application = await ownStaffApplication(p, user, batchID), batch = await publicStaffBatch(p, batchID).catch(() => null);
    if (!batch && !application) throw new APIError("批次尚未发布或已移除", 404);
    // Submitted questions are a receipt snapshot, not a reusable questionnaire.
    const form = batch ? staffForm(batch.signupForm) : null;
    const version = form ? formVersion(form) : application!.formVersion, state = batch ? staffWindow(batch) : "批次已撤下，仅可查看回执";
    const open = state === "申请开放", final = Boolean(application && ["accepted", "rejected"].includes(application.status));
    return { title: batch?.title ?? application!.batchTitle, description: batch?.description, startAt: batch?.startAt, endAt: batch?.endAt,
      form, version, state, loggedIn: true, draftKey: batch ? "staff:" + batchID + ":" + user.id + ":" + version : undefined,
      application: application ? staffReceipt(application) : null,
      actions: { submit: open && (!application || application.status === "withdrawn"), edit: open && Boolean(application) && !final,
        withdraw: open && Boolean(application && application.status !== "withdrawn") && !final, review: canManageStaffRecruitment(user) },
      privacy: staffPrivacy, deadlinePolicy: staffDeadlinePolicy };
  }
  if (path === applicationPath) {
    const review = query.get("mode") === "review";
    if (review && !canReviewCommunityApplication(user)) throw new APIError("无权审核社群申请", 403);
    const result = await p.find({ collection: "community-applications", overrideAccess: false, user, depth: 0, limit: 20,
      page: pageNumber(query), sort: review ? "createdAt" : "-createdAt", select: applicationSelect,
      where: review ? { status: { equals: "pending" } } : { applicant: { equals: user.id } } });
    return pageResult(result, result.docs.map(row => applicationReceipt(row, user)));
  }
  const join = joinPath.exec(path);
  if (join) {
    const gameID = id(join[1]);
    const game = await p.findByID({ collection: "games", id: gameID, user: null, overrideAccess: false, draft: false, depth: 0,
      select: { title: true, _status: true } }).catch(() => null);
    if (!game || game._status !== "published") throw new APIError("该社群尚未开放", 404);
    const canHandle = canHandleCommunityJoins(user, gameID);
    if (query.get("mode") === "manage") {
      if (!canHandle) throw new APIError("无权处理此社群进群", 403);
      const result = await p.find({ collection: "community-joins", overrideAccess: false, user, depth: 0, limit: 20,
        page: pageNumber(query), sort: "createdAt", select: joinSelect,
        where: { and: [{ game: { equals: gameID } }, { status: { in: ["requested", "friendReported", "awaitingInvite"] } }] } });
      return { ...pageResult(result, result.docs.map(row => ({ ...joinReceipt(row), actions: handlingActions(row, user, gameID) }))), canHandle };
    }
    const row = (await p.find({ collection: "community-joins", overrideAccess: false, user, depth: 0, limit: 1, select: joinSelect,
      where: { and: [{ game: { equals: gameID } }, { member: { equals: user.id } }] } })).docs[0] ?? null;
    return { record: row ? joinReceipt(row) : null, actions: joinActions(row, user), canHandle };
  }
  throw new APIError("接口不存在", 404);
}

export async function miniappClubPOST(p: Payload, request: Request, path: string, data: Record<string, unknown>) {
  const user = await currentUser(p, request), action = text(data.action);
  if (path === applicationPath) {
    let saved: CommunityApplication;
    if (action === "submit" || action === "edit") {
      const value = { game: optionalID(data.game) ?? null, proposedGame: text(data.proposedGame), realName: text(data.realName),
        phone: text(data.phone), reason: text(data.reason), contactConsent: data.contactConsent === true,
        ...(data.wechatQr === undefined ? {} : { wechatQr: text(data.wechatQr) }), status: "pending" as const, applicant: user.id };
      saved = action === "submit" ? await p.create({ collection: "community-applications", overrideAccess: false, user, data: value })
        : await editCommunityApplication(p, user, id(data.id), data.revision, value);
    } else if (action === "withdraw") saved = await editCommunityApplication(p, user, id(data.id), data.revision, { status: "withdrawn" });
    else if (action === "card") saved = await updateCommunityCard(p, user, id(data.id), data.revision, {
      contactConsent: data.contactConsent === true, ...(data.wechatQr === undefined ? {} : { wechatQr: text(data.wechatQr) }) });
    else if (action === "review") saved = await decideCommunityApplication(p, user, id(data.id), text(data.decision), text(data.reviewNote), data.revision);
    else throw new APIError("操作无效", 400);
    return { application: applicationReceipt(saved, user) };
  }
  const join = joinPath.exec(path);
  if (!join || !["request", "reportFriend", "withdraw", "confirmFriend", "confirmJoined"].includes(action)) throw new APIError("操作无效", 400);
  const gameID = id(join[1]);
  const row = await changeCommunityJoin(p, user, gameID, action, { id: optionalID(data.id), contact: optionalID(data.contact), revision: data.revision, note: text(data.note) });
  return { record: { ...joinReceipt(row), actions: handlingActions(row, user, gameID) }, actions: joinActions(row, user), canHandle: canHandleCommunityJoins(user, gameID) };
}
