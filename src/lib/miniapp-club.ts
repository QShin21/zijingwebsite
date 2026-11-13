import { APIError, type Payload } from "payload";
import type { CommunityApplication, StaffApplication, StaffBatch, User } from "../payload-types";
import { canManageStaffRecruitment, canParticipate, canUseCampus, canReviewCommunityApplication, relationID } from "./rules";
import { currentStaffBatches, ownStaffApplication, publicStaffBatch, readStaffApplications } from "./staff-recruitment";
import { canReviewStaffTransition, staffDeadlinePolicy, staffForm, staffPrivacy, staffWindow } from "./staff-recruitment-model";
import { formVersion } from "./activity-signups";
import { refreshViewer } from "./v2/identity";
import { promotedContent } from "./content-promotions";
import { decideCommunityApplication, editCommunityApplication, updateCommunityCard } from "./community-operations";
import { applicationContactConsentRequiredMessage } from "./community-status";

const applicationPath = "community/applications";
const staffPath = /^staff\/([^/]+)$/;
export const miniappClubReadPath = (path: string) => ["club", "staff", "workbench", applicationPath].includes(path) || staffPath.test(path);
export const miniappClubWritePath = (path: string) => path === applicationPath;
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
    select: { name: true, email: true, createdAt: true, updatedAt: true, roles: true, accountStatus: true, affiliation: true, communityOffices: true } }).catch(() => null);
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
export async function miniappClubGET(p: Payload, request: Request, path: string) {
  if (path === "club") {
    const { user } = await p.auth({ headers: request.headers });
    const viewer = await refreshViewer(p, user);
    const [batches, event, notice, showcase] = await Promise.all([
      canUseCampus(viewer) ? currentStaffBatches(p) : [],
      promotedContent(p, "event", 6, viewer), promotedContent(p, "notice", 6, viewer), promotedContent(p, "showcase", 6, viewer),
    ]);
    return { staffBatches: batches.map(staffBatchReceipt), promotions: { event, notice, showcase } };
  }
  const user = await currentUser(p, request);
  if (!canUseCampus(user)) throw new APIError("此栏目仅面向清华账号", 403);
  if (path === "staff") {
    const result = await p.find({ collection: "staff-batches", overrideAccess: false, user: null, depth: 0, limit: 12,
      page: pageNumber(new URL(request.url).searchParams), sort: "-createdAt",
      select: { title: true, description: true, state: true, startAt: true, endAt: true, signupForm: true } });
    return pageResult(result, result.docs.map(staffBatchReceipt));
  }
  const query = new URL(request.url).searchParams;
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
  throw new APIError("接口不存在", 404);
}

export async function miniappClubPOST(p: Payload, request: Request, path: string, data: Record<string, unknown>) {
  const user = await currentUser(p, request), action = text(data.action);
  if (!canUseCampus(user)) throw new APIError("此栏目仅面向清华账号", 403);
  if (path === applicationPath) {
    let saved: CommunityApplication;
    if (action === "submit" || action === "edit") {
      if (data.contactConsent !== true) throw new APIError(applicationContactConsentRequiredMessage, 400);
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
  throw new APIError("接口不存在", 404);
}
