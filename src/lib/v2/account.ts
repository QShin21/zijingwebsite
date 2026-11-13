import type { Payload, Where } from "payload";
import type { User } from "@/payload-types";
import {
  canManageStaffRecruitment,
  canPublish,
  canReviewCommunityApplication,
  canReviewPromotion,
  canSubmitClubContent,
  communityIDs,
} from "../rules";
import { applicationLabels } from "../community-status";
import { staffStatusLabels } from "../staff-recruitment-model";
import { teamApplicationLabels } from "../team-core";
import { isEstablishedTeam } from "../team-memberships";
import { calendarCards, eventCard, eventFields } from "./events";
import { archivedIDs, archivedTargets } from "./archives";
import { canUseCampus } from "../rules";
import { refreshViewer, requireViewer, viewerProjection } from "./identity";
import { iso, pageInput, publicWhere, rel, selectFields, teamRef, txt, type Input, type Row } from "./shared";
import type { ApplicationItem, EventCard, ManageQueue, MembershipView, MeResponse, Page, SignupReceiptCard, TodoItem } from "./types";

type ApplicationKind = ApplicationItem["kind"];
type ApplicationCollection = "staff-applications" | "team-join-applications" | "team-establishment-applications" | "community-applications";
type Source = { kind: ApplicationKind; collection: ApplicationCollection; fields: readonly string[]; active: string[] };
const sources: Source[] = [
  { kind: "staff", collection: "staff-applications", fields: ["applicant", "batch", "batchTitle", "status", "updatedAt"], active: ["submitted", "reviewing", "returned"] },
  { kind: "teamJoin", collection: "team-join-applications", fields: ["applicant", "title", "recruitment", "status", "updatedAt"], active: ["draft", "pending", "returned"] },
  { kind: "teamEstablishment", collection: "team-establishment-applications", fields: ["applicant", "title", "status", "updatedAt"], active: ["pending", "returned"] },
  { kind: "communityOfficer", collection: "community-applications", fields: ["applicant", "proposedGame", "status", "updatedAt"], active: ["pending", "returned"] },
];
const ownWhere = (user: User, extra: Where = {}): Where => ({ and: [{ applicant: { equals: user.id } }, extra] });
/** Personal archive view: `hide` removes archived rows in the database query, before any count, sort or truncation. */
type ArchiveView = { archived: Set<string>; hide: boolean };
const visibleWhere = (source: Source, view: ArchiveView, where: Where = {}): Where => {
  const ids = view.hide ? archivedIDs(view.archived, source.kind) : [];
  return ids.length ? { and: [where, { id: { not_in: ids } }] } : where;
};
const newest = (a: ApplicationItem, b: ApplicationItem) => b.updatedAt.localeCompare(a.updatedAt) || a.key.localeCompare(b.key);
const progressSteps = (status: string): ApplicationItem["steps"] => {
  const stage = status === "draft" ? 0 : ["approved", "accepted", "rejected", "withdrawn"].includes(status) ? 2 : 1;
  return ["已提交", "审核中", "结果"].map((label, index) => ({ label, state: index < stage ? "done" : index === stage ? "current" : "todo" }));
};

function applicationItem(source: Source, row: Row, archived: Set<string>): ApplicationItem {
  const status = txt(row.status) ?? "pending";
  const tone: ApplicationItem["tone"] = ["draft", "returned"].includes(status) ? "warning" : ["approved", "accepted"].includes(status) ? "success" : status === "rejected" ? "danger" : ["pending", "submitted", "reviewing"].includes(status) ? "info" : "neutral";
  let title = txt(row.title) ?? "申请记录", categoryLabel: string, href: string, next: string, labels: Record<string, string>;
  if (source.kind === "staff") {
    title = txt(row.batchTitle) ?? "骨干申请";
    categoryLabel = "骨干招新"; labels = staffStatusLabels;
    href = rel(row.batch) ? `/join/staff/batches/${rel(row.batch)}` : "/join/staff";
    next = status === "returned" ? "查看反馈，按要求补充后重新提交。" : status === "accepted" ? "已录用；平台角色与任职由负责人另行处理。" : "查看自己的申请、处理意见与回执。";
  } else if (source.kind === "teamJoin") {
    categoryLabel = "入队申请"; labels = teamApplicationLabels;
    href = rel(row.recruitment) ? `/teams/recruitment/${rel(row.recruitment)}` : "/teams/recruitment";
    next = status === "draft" ? "申请仍为草稿，核对后提交人工选拔。" : status === "returned" ? "查看审核意见，补充资料后重新提交。" : "录取结果与成员关系以实际回执为准。";
  } else if (source.kind === "teamEstablishment") {
    categoryLabel = "建队申请"; labels = teamApplicationLabels;
    href = ["returned", "withdrawn"].includes(status) ? `/teams/apply?edit=${row.id}` : "/teams/apply#team-applications-title";
    next = status === "returned" ? "补充建队资料后重新提交。" : "查看建队申请与负责人处理意见。";
  } else {
    title = txt(row.proposedGame) ?? "社群管理员申请";
    categoryLabel = "社群管理员申请"; labels = applicationLabels;
    href = ["returned", "withdrawn"].includes(status) ? `/community/apply?edit=${row.id}` : "/community/apply#my-applications-title";
    next = status === "returned" ? "查看反馈，补充申请资料。" : "社群任职独立授权，微信建群与拉群由管理员人工完成。";
  }
  return { key: `${source.kind}:${row.id}`, kind: source.kind, categoryLabel, title, status, statusLabel: labels[status] ?? "处理中", tone, href, webOnly: false, updatedAt: iso(row.updatedAt) ?? "", next, steps: progressSteps(status),
    archived: archived.has(`${source.kind}:${row.id}`) };
}

async function applicationRows(p: Payload, user: User, source: Source, where: Where, limit: number, all = false) {
  const result = await p.find({ collection: source.collection, user, overrideAccess: false, depth: 0, limit,
    ...(all ? { pagination: false } : {}), page: 1, sort: "-updatedAt", where: ownWhere(user, where), select: selectFields(source.fields) });
  // In addition to the collection's current-role access, constrain every owner projection explicitly.
  const rows = (result.docs as unknown as Row[]).filter(row => rel(row.applicant) === user.id);
  return { rows, totalDocs: result.totalDocs };
}

/** Internal helper: the caller must pass a freshly loaded account. */
export async function ownApplicationPage(p: Payload, user: User, input: Input = {}, activeFirst = false, view?: ArchiveView): Promise<Page<ApplicationItem>> {
  const { page, limit } = pageInput(input), end = page * limit;
  if (!canUseCampus(user)) return { docs: [], page, totalDocs: 0, totalPages: 0, hasNextPage: false };
  const archive = view ?? { archived: await archivedTargets(p, user), hide: false };
  const counts = await Promise.all(sources.map(source => p.count({ collection: source.collection, user, overrideAccess: false, where: ownWhere(user, visibleWhere(source, archive)) })));
  const totalDocs = counts.reduce((total, count) => total + count.totalDocs, 0), totalPages = Math.ceil(totalDocs / limit);
  if ((page - 1) * limit >= totalDocs) return { docs: [], page, totalPages, totalDocs, hasNextPage: false };
  const primary = await Promise.all(sources.map(async source => {
    const result = await applicationRows(p, user, source, visibleWhere(source, archive, activeFirst ? { status: { in: source.active } } : {}), end);
    return { source, ...result };
  }));
  let docs = primary.flatMap(({ source, rows }) => rows.map(row => applicationItem(source, row, archive.archived))).sort(newest);
  if (activeFirst) {
    const activeTotal = primary.reduce((total, result) => total + result.totalDocs, 0);
    if (activeTotal < end) {
      const history = await Promise.all(sources.map(async source => {
        const result = await applicationRows(p, user, source, visibleWhere(source, archive, { status: { not_in: source.active } }), end - activeTotal);
        return result.rows.map(row => applicationItem(source, row, archive.archived));
      }));
      docs = [...docs, ...history.flat().sort(newest)];
    }
  }
  return { docs: docs.slice((page - 1) * limit, end), page, totalPages, totalDocs, hasNextPage: page < totalPages };
}

async function ownApplicationCount(p: Payload, user: User): Promise<number> {
  if (!canUseCampus(user)) return 0;
  const counts = await Promise.all(sources.map(source => p.count({ collection: source.collection, user, overrideAccess: false, where: ownWhere(user) })));
  return counts.reduce((total, count) => total + count.totalDocs, 0);
}

/** Owner-only headers for unpaginated recruitment/todo surfaces; no private answers are read. */
export async function ownApplicationItems(p: Payload, user: User, kinds?: ApplicationKind[], statuses?: string[]): Promise<ApplicationItem[]> {
  if (!canUseCampus(user)) return [];
  const archived = await archivedTargets(p, user);
  const records = await Promise.all(sources.filter(source => !kinds || kinds.includes(source.kind)).map(async source => {
    // Different collections use different PostgreSQL enums. Only team joins
    // have a draft state; passing it to staff/community enums is a DB error.
    const allowed = source.kind === "teamJoin" ? ["draft", "pending", "returned", "approved", "rejected", "withdrawn"]
      : source.kind === "staff" ? ["submitted", "reviewing", "returned", "accepted", "rejected", "withdrawn"]
      : ["pending", "returned", "approved", "rejected", "withdrawn"];
    const matching = statuses?.filter(status => allowed.includes(status));
    if (matching && !matching.length) return [];
    const { rows } = await applicationRows(p, user, source, matching ? { status: { in: matching } } : {}, 0, true);
    return rows.map(row => applicationItem(source, row, archived));
  }));
  return records.flat().sort(newest);
}

export async function getMyApplications(p: Payload, viewer: User | null, input: Input = {}): Promise<Page<ApplicationItem>> {
  return ownApplicationPage(p, await requireViewer(p, viewer), input);
}

export async function getMySignups(p: Payload, viewer: User | null, input: Input = {}): Promise<Page<SignupReceiptCard>> {
  const user = await requireViewer(p, viewer), { page, limit } = pageInput(input), archived = await archivedTargets(p, user);
  const result = await p.find({ collection: "event-signups", user, overrideAccess: false, depth: 0, page, limit, sort: "-updatedAt",
    where: { member: { equals: user.id } }, select: { member: true, activityType: true, activityID: true, eventTitle: true, createdAt: true, updatedAt: true } });
  const receipts = result.docs.filter(row => rel(row.member) === user.id);
  const ids = (kind: string) => [...new Set(receipts.filter(row => row.activityType === kind).map(row => rel(row.activityID)).filter((id): id is number => id !== null))];
  const clubIDs = ids("events"), communityIDs = ids("community-posts");
  const [club, community] = await Promise.all([
    clubIDs.length ? p.find({ collection: "events", user, overrideAccess: false, draft: false, depth: 0, pagination: false, limit: 0,
      where: publicWhere({ id: { in: clubIDs } }), select: selectFields(eventFields) }) : { docs: [] },
    communityIDs.length ? p.find({ collection: "community-posts", user, overrideAccess: false, draft: false, depth: 0, pagination: false, limit: 0,
      where: { and: [{ id: { in: communityIDs } }, { category: { equals: "event" } }, { status: { equals: "visible" } }] }, select: selectFields(eventFields) }) : { docs: [] },
  ]);
  const submissions = new Set([...clubIDs.map(id => `club:${id}`), ...communityIDs.map(id => `community:${id}`)]);
  const cards = new Map<string, EventCard>();
  await Promise.all([
    ...club.docs.filter(row => clubIDs.includes(row.id) && row._status === "published" && !(process.env.APP_ENV === "production" && row.demo))
      .map(async row => { const card = await eventCard(p, row as unknown as Row, "club", user, submissions); cards.set(card.key, card); }),
    ...community.docs.filter(row => communityIDs.includes(row.id) && row.status === "visible" && row.category === "event")
      .map(async row => { const card = await eventCard(p, row as unknown as Row, "community", user, submissions); cards.set(card.key, card); }),
  ]);
  const docs = receipts.map(row => {
    const kind = row.activityType === "events" ? "club" : row.activityType === "community-posts" ? "community" : null;
    const event = kind ? cards.get(`${kind}:${row.activityID}`) ?? null : null;
    // The archive target is derived from the own receipt, so it survives an activity being withdrawn.
    const archiveTarget = kind && Number.isSafeInteger(row.activityID) && row.activityID > 0 ? `${kind}:${row.activityID}` : null;
    return { key: `signup:${row.id}`, eventTitle: row.eventTitle, event, submittedAt: row.createdAt, updatedAt: row.updatedAt,
      href: kind && event ? `/activities/${row.activityType}/${row.activityID}/fill` : "/account", editable: Boolean(event && event.signup.mode === "form" && event.signup.state === "open"),
      archiveTarget, archived: archiveTarget !== null && archived.has(archiveTarget) };
  });
  return { docs, page, totalDocs: result.totalDocs, totalPages: result.totalPages, hasNextPage: result.hasNextPage };
}

async function ownMemberships(p: Payload, user: User): Promise<MembershipView[]> {
  const result = await p.find({ collection: "team-memberships", user, overrideAccess: false, depth: 0, pagination: false, limit: 0,
    sort: "-updatedAt", where: { member: { equals: user.id } }, select: { member: true, team: true, status: true, joinedAt: true, leftAt: true } });
  const projected = await Promise.all(result.docs.filter(row => rel(row.member) === user.id).map(async row => {
    const team = await teamRef(p, row.team);
    if (!team) return null;
    const established = row.status === "active" && !row.leftAt && await isEstablishedTeam(p, team.id);
    return { id: row.id, team, status: row.leftAt ? "left" as const : row.status, joinedAt: iso(row.joinedAt), leftAt: iso(row.leftAt),
      actions: { editProfile: established, submitHonor: established, leave: row.status === "active" } };
  }));
  return projected.filter((row): row is MembershipView => row !== null);
}

async function manageQueues(p: Payload, user: User): Promise<ManageQueue[]> {
  const queues: ManageQueue[] = [];
  const high = canPublish(user), joins = communityIDs(user, "handleJoins"), reviews = communityIDs(user, "reviewShowcase");
  const scope = high ? "全部社群" : "已授权社群";
  // Counting never bypasses collection access. A failed safe count is unknown, not zero.
  const count = async (collection: ApplicationCollection | "team-honor-records" | "content-promotions" | "community-showcase", where: Where): Promise<number | null> => {
    try { return (await p.count({ collection, user, overrideAccess: false, where })).totalDocs; } catch { return null; }
  };
  if (canReviewCommunityApplication(user)) queues.push({ key: "communityApplications", title: "社群管理员申请", href: "/community/review", webOnly: false, pending: await count("community-applications", { status: { equals: "pending" } }), scope });
  if (canManageStaffRecruitment(user)) queues.push({ key: "staffApplications", title: "骨干招新申请", href: "/staff/manage", webOnly: false, pending: await count("staff-applications", { status: { in: ["submitted", "reviewing"] } }), scope: "全部骨干批次" });
  if (high) queues.push({ key: "teamEstablishments", title: "建队申请", href: "/teams/manage", webOnly: false, pending: await count("team-establishment-applications", { status: { equals: "pending" } }), scope });
  if (high || joins.length) {
    const managed = await p.find({ collection: "teams", user, overrideAccess: false, draft: false, depth: 0, limit: 1,
      where: high ? { game: { exists: true } } : { game: { in: joins } }, select: { game: true } });
    if (managed.docs.some(team => rel(team.game) !== null && (high || joins.includes(String(rel(team.game)))))) queues.push({ key: "teamJoins", title: "入队申请", href: "/teams/manage", webOnly: false,
      pending: await count("team-join-applications", { and: [{ status: { equals: "pending" } }, ...(high ? [] : [{ game: { in: joins } }])] }), scope });
  }
  if (high || reviews.length) queues.push({ key: "honors", title: "代表队荣誉审核", href: "/teams/honors?view=review", webOnly: false, pending: await count("team-honor-records",
    { and: [{ state: { equals: "pending" } }, { author: { not_equals: user.id } }, ...(high ? [] : [{ game: { in: reviews } }])] }), scope });
  if (canReviewPromotion(user)) queues.push({ key: "promotions", title: "社群升推审核", href: "/community/promotions?view=review", webOnly: true, pending: await count("content-promotions", { status: { equals: "pending" } }), scope: "全部社群" });
  if (high || reviews.length) queues.push({ key: "showcase", title: "社群风采审核", href: "/community", webOnly: false, pending: await count("community-showcase",
    { and: [{ status: { equals: "pending" } }, ...(high ? [] : [{ game: { in: reviews } }])] }), scope });
  if (canSubmitClubContent(user) || communityIDs(user, "viewSignups").length) queues.push({ key: "activities", title: "活动问卷工作台", href: "/activities", webOnly: true, pending: null, scope: high ? "全部活动" : "本人及已授权活动" });
  if (canSubmitClubContent(user)) queues.push({ key: "cms", title: "内容管理后台", href: "/admin", webOnly: true, pending: null, scope: high ? "社团内容" : "授权范围内的草稿" });
  return queues;
}

export async function getManage(p: Payload, viewer: User | null, input: Input = {}): Promise<{ queues: ManageQueue[] }> {
  void input;
  const user = await refreshViewer(p, viewer);
  return { queues: user && canUseCampus(user) ? await manageQueues(p, user) : [] };
}

export async function getMe(p: Payload, viewer: User | null, input: Input = {}): Promise<MeResponse> {
  void input;
  const user = await requireViewer(p, viewer);
  const campus = canUseCampus(user), archived = await archivedTargets(p, user);
  const [projection, applications, allApplications, attention, memberships, mine, signups, queues, honors] = await Promise.all([
    // Archived records are excluded inside the queries, before the 8/5 overview limits.
    viewerProjection(p, user), ownApplicationPage(p, user, { limit: 8 }, true, { archived, hide: true }), ownApplicationCount(p, user),
    // Todo keeps every draft/returned application: archiving only tidies the progress list.
    ownApplicationItems(p, user, undefined, ["draft", "returned"]),
    campus ? ownMemberships(p, user) : [], calendarCards(p, user, { scope: "mine", range: "upcoming" }),
    p.count({ collection: "event-signups", user, overrideAccess: false, where: { member: { equals: user.id } } }), campus ? manageQueues(p, user) : [],
    campus ? p.find({ collection: "team-honor-records", user, overrideAccess: false, depth: 0, pagination: false, limit: 0, sort: "-updatedAt",
      where: { and: [{ author: { equals: user.id } }, { state: { equals: "returned" } }] }, select: { author: true, title: true, state: true, updatedAt: true } }) : { docs: [] },
  ]);
  const todo: TodoItem[] = [
    ...attention.map(row => ({ key: row.key, kind: row.status === "draft" ? "applicationDraft" as const : "applicationReturned" as const,
      title: row.title, detail: row.next, href: row.href, webOnly: row.webOnly, updatedAt: row.updatedAt, count: null })),
    ...honors.docs.filter(row => rel(row.author) === user.id && row.state === "returned").map(row => ({ key: `honor:${row.id}`, kind: "honorReturned" as const,
      title: row.title, detail: "查看审核意见，修改荣誉资料后重新提交。", href: "/teams/honors?view=mine", webOnly: false, updatedAt: iso(row.updatedAt), count: null })),
    ...queues.filter(queue => queue.pending !== null && queue.pending > 0).map(queue => ({ key: `review:${queue.key}`, kind: "review" as const,
      title: queue.title, detail: `待处理 ${queue.pending} 项。`, href: queue.href, webOnly: queue.webOnly, updatedAt: null, count: queue.pending })),
  ];
  const upcoming = mine.filter(card => !archived.has(card.key));
  return { viewer: projection, todo, upcoming: upcoming.slice(0, 5), applications: applications.docs.slice(0, 8), memberships,
    counts: { signups: signups.totalDocs, applications: allApplications, archivedApplications: Math.max(0, allApplications - applications.totalDocs),
      archivedUpcoming: mine.length - upcoming.length } };
}
