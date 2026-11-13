import { APIError, type Payload } from "payload";
import type { Team, TeamEstablishmentApplication, TeamJoinApplication, TeamMembership, TeamRecruitment, User } from "../payload-types";
import { canUseCampus, canPublish, communityIDs } from "./rules";
import { canManageTeam, canProposeTeam, currentTeamActor, isEstablishedTeam, positiveID } from "./team-memberships";
import { normalizeTeamForm, teamID, teamJoinReceipt, teamRecruitmentInfo, teamRecruitmentState } from "./team-core";

const recruitmentPath = /^team\/recruitment\/([^/]+)$/;
const workbenchPath = /^team\/([^/]+)\/workbench$/;
export const miniappTeamReadPath = (path: string) => path === "team" || path === "team/establishments" || recruitmentPath.test(path) || workbenchPath.test(path);
const pageNumber = (query: URLSearchParams, key = "page") => Math.max(1, Math.min(10000, Math.floor(Number(query.get(key)) || 1)));
function pageResult<T, V>(result: { docs: T[]; page?: number; totalPages: number; totalDocs: number; hasNextPage: boolean }, docs: V[]) {
  return { docs, page: result.page ?? 1, totalPages: result.totalPages, totalDocs: result.totalDocs, hasNextPage: result.hasNextPage };
}
const emptyPage = (page: number) => ({ docs: [], page, totalPages: 1, totalDocs: 0, hasNextPage: false });
type Recruitment = Pick<TeamRecruitment, "id" | "title" | "team" | "game" | "status" | "signupForm" | "updatedAt">;
type Membership = Pick<TeamMembership, "id" | "title" | "team" | "game" | "member" | "status" | "joinedAt" | "revokedAt" | "leftAt" | "updatedAt">;
type OwnApplication = Pick<TeamJoinApplication, "id" | "title" | "team" | "recruitment" | "status" | "reviewNote" | "updatedAt" | "createdAt">;
type Establishment = Pick<TeamEstablishmentApplication, "id" | "title" | "game" | "applicant" | "reason" | "status" | "team" | "reviewNote" | "createdAt" | "updatedAt">;
type ManagedTeam = Pick<Team, "id" | "title" | "game" | "teamStatus" | "archived" | "updatedAt" | "establishmentApplication">;
const recruitmentSelect = { title: true, team: true, game: true, status: true, signupForm: true, updatedAt: true } as const;
const membershipSelect = { title: true, team: true, game: true, member: true, status: true, joinedAt: true, revokedAt: true, leftAt: true, updatedAt: true } as const;
const ownApplicationSelect = { title: true, team: true, recruitment: true, status: true, reviewNote: true, createdAt: true, updatedAt: true } as const;
const teamSelect = { title: true, game: true, teamStatus: true, archived: true, updatedAt: true, establishmentApplication: true } as const;
const establishmentSelect = { title: true, game: true, applicant: true, reason: true, status: true, team: true, reviewNote: true, createdAt: true, updatedAt: true } as const;

async function context(p: Payload, request: Request) {
  const { user: authenticated } = await p.auth({ headers: request.headers });
  if (!authenticated?.id) throw new APIError("请先登录可用账号", 401);
  const fresh = await currentTeamActor(p, authenticated);
  if (!canUseCampus(fresh)) throw new APIError("账号已停用或不可用，请联系负责人", 403);
  const user: User = { ...authenticated!, ...fresh!, roles: fresh!.roles, accountStatus: fresh!.accountStatus,
    communityOffices: fresh!.communityOffices, collection: "users" };
  const infos = new Map<number, Promise<Awaited<ReturnType<typeof teamRecruitmentInfo>> | null>>();
  const memberships = new Map<number, Promise<Membership | null>>();
  const established = new Map<number, Promise<boolean>>();
  const managers = new Map<number, Promise<boolean>>();
  const otherApplications = new Map<number, Promise<boolean>>();
  const info = (id: number) => {
    if (!infos.has(id)) infos.set(id, teamRecruitmentInfo(p, user, id).catch(error => {
      if (error && typeof error === "object" && "status" in error && [403, 404].includes(Number(error.status))) return null;
      throw error;
    }));
    return infos.get(id)!;
  };
  const membership = (id: number) => {
    if (!memberships.has(id)) memberships.set(id, p.find({ collection: "team-memberships", user, overrideAccess: false, depth: 0, limit: 1,
      where: { and: [{ member: { equals: user.id } }, { team: { equals: id } }] }, select: membershipSelect }).then(result => result.docs[0] ?? null));
    return memberships.get(id)!;
  };
  const isEstablished = (id: number) => {
    if (!established.has(id)) established.set(id, isEstablishedTeam(p, id));
    return established.get(id)!;
  };
  const manages = (id: number) => {
    if (!managers.has(id)) managers.set(id, canManageTeam(p, user, id));
    return managers.get(id)!;
  };
  const otherApplication = (id: number, team: number) => {
    if (!otherApplications.has(id)) otherApplications.set(id, p.find({ collection: "team-join-applications", user, overrideAccess: false,
      depth: 0, limit: 1, select: { status: true }, where: { and: [{ applicant: { equals: user.id } }, { team: { equals: team } },
        { recruitment: { not_equals: id } }, { status: { in: ["draft", "pending", "returned"] } }] } }).then(result => result.docs.length > 0));
    return otherApplications.get(id)!;
  };
  return { p, user, info, membership, isEstablished, manages, otherApplication };
}
type Context = Awaited<ReturnType<typeof context>>;

function membershipReceipt(row: Membership, user: User, manager = false) {
  return { id: row.id, title: row.title, teamID: positiveID(row.team), gameID: positiveID(row.game), status: row.status,
    joinedAt: row.joinedAt, revokedAt: row.revokedAt ?? null, leftAt: row.leftAt ?? null, updatedAt: row.updatedAt,
    ...(manager ? { memberID: positiveID(row.member) } : {}),
    actions: { leave: positiveID(row.member) === user.id && row.status === "active", ...(manager ? { revoke: row.status === "active" } : {}) } };
}
const teamReceipt = (row: ManagedTeam) => ({ id: row.id, title: row.title, gameID: positiveID(row.game), teamStatus: row.teamStatus ?? "unestablished", updatedAt: row.updatedAt });
async function recruitmentActions(ctx: Context, id: number) {
  const info = await ctx.info(id);
  if (!info || info.readOnly) return { draft: false, submit: false, edit: false, withdraw: false, review: false, workbench: false };
  const team = teamID(info.doc.team), [member, other, manager] = await Promise.all([ctx.membership(team), ctx.otherApplication(id, team), ctx.manages(team)]);
  const writable = info.state === "招新开放" && !["approved", "rejected"].includes(info.own?.status ?? "") && member?.status !== "active" && !other;
  return { draft: writable, submit: writable, edit: writable && Boolean(info.own),
    withdraw: Boolean(info.own && ["draft", "pending", "returned"].includes(info.own.status)), review: manager, workbench: manager };
}
async function recruitmentReceipt(row: Recruitment, ctx: Context, workbench = false) {
  const team = teamID(row.team), form = normalizeTeamForm(row.signupForm);
  const [established, manager, actions] = await Promise.all([ctx.isEstablished(team), ctx.manages(team), recruitmentActions(ctx, row.id)]);
  const canWorkbench = manager && actions.workbench;
  return { id: row.id, title: row.title, teamID: team, gameID: positiveID(row.game), status: row.status,
    state: established ? teamRecruitmentState(row, form) : "队伍未开放招新", startAt: form.start, endAt: form.end, updatedAt: row.updatedAt,
    actions: { view: true, apply: actions.submit, workbench: canWorkbench,
      ...(workbench ? { edit: canWorkbench && established && row.status !== "archived", close: canWorkbench && row.status === "open", archive: canWorkbench && row.status !== "archived" } : {}) } };
}
async function ownApplicationReceipt(row: OwnApplication, ctx: Context) {
  const actions = await recruitmentActions(ctx, teamID(row.recruitment));
  return { id: row.id, title: row.title, status: row.status, teamID: positiveID(row.team), recruitmentID: positiveID(row.recruitment),
    createdAt: row.createdAt, updatedAt: row.updatedAt, reviewNote: row.reviewNote ?? null,
    actions: { view: true, edit: actions.edit, withdraw: actions.withdraw } };
}
async function proposalGames(ctx: Context) {
  const result = await ctx.p.find({ collection: "games", user: null, overrideAccess: false, draft: false, depth: 0, pagination: false,
    where: { and: [{ _status: { equals: "published" } }, { archived: { not_equals: true } }] }, select: { title: true } });
  return { games: result.docs, proposals: result.docs.filter(game => canProposeTeam(ctx.user, game.id))
    .map(game => ({ id: game.id, title: game.title, actions: { establish: true } })) };
}
async function establishments(ctx: Context, query: URLSearchParams) {
  const mode = query.get("mode") ?? "own";
  if (!["own", "review"].includes(mode)) throw new APIError("查询入口无效", 400);
  const review = mode === "review", canReview = canPublish(ctx.user);
  if (review && !canReview) throw new APIError("无权审核建队申请", 403);
  const [{ games, proposals }, result] = await Promise.all([proposalGames(ctx), ctx.p.find({ collection: "team-establishment-applications", user: ctx.user,
    overrideAccess: false, depth: 0, limit: 20, page: pageNumber(query), sort: review ? "createdAt" : "-updatedAt", select: establishmentSelect,
    where: review ? { status: { equals: "pending" } } : { applicant: { equals: ctx.user.id } } })]);
  const visibleGames = new Set(games.map(game => game.id));
  const docs = await Promise.all(result.docs.map(async (row: Establishment) => {
    const own = positiveID(row.applicant) === ctx.user.id, game = teamID(row.game);
    let decisions: string[] = [];
    if (review && canReview && row.status === "pending") {
      const applicant = await currentTeamActor(ctx.p, { id: teamID(row.applicant) });
      decisions = [...(visibleGames.has(game) && canProposeTeam(applicant, game) ? ["approved"] : []), "returned", "rejected"];
    }
    return { id: row.id, title: row.title, gameID: game, reason: row.reason, status: row.status, teamID: positiveID(row.team),
      createdAt: row.createdAt, updatedAt: row.updatedAt, reviewNote: row.reviewNote ?? null,
      actions: { edit: own && visibleGames.has(game) && canProposeTeam(ctx.user, game) && ["returned", "withdrawn"].includes(row.status),
        withdraw: own && ["pending", "returned"].includes(row.status), reviewDecisions: decisions } };
  }));
  return { ...pageResult(result, docs), proposalGames: proposals, actions: { establish: proposals.length > 0, reviewEstablishments: canReview } };
}
async function hub(ctx: Context, query: URLSearchParams) {
  const { games, proposals } = await proposalGames(ctx), scope = communityIDs(ctx.user, "handleJoins");
  const allowed = games.filter(game => canPublish(ctx.user) || scope.includes(String(game.id))).map(game => game.id);
  const [recruitments, own, members, managed] = await Promise.all([
    ctx.p.find({ collection: "team-recruitments", user: ctx.user, overrideAccess: false, depth: 0, limit: 20, page: pageNumber(query), sort: "-createdAt",
      where: { status: { in: ["open", "closed", "archived"] } }, select: recruitmentSelect }),
    ctx.p.find({ collection: "team-join-applications", user: ctx.user, overrideAccess: false, depth: 0, limit: 20, page: pageNumber(query, "ownPage"), sort: "-updatedAt",
      where: { applicant: { equals: ctx.user.id } }, select: ownApplicationSelect }),
    ctx.p.find({ collection: "team-memberships", user: ctx.user, overrideAccess: false, depth: 0, limit: 20, page: pageNumber(query, "membersPage"), sort: "-updatedAt",
      where: { member: { equals: ctx.user.id } }, select: membershipSelect }),
    allowed.length ? ctx.p.find({ collection: "teams", user: null, overrideAccess: false, draft: false, depth: 0, limit: 20,
      page: pageNumber(query, "teamsPage"), where: { game: { in: allowed } }, select: teamSelect }) : Promise.resolve(emptyPage(pageNumber(query, "teamsPage"))),
  ]);
  const [recruitmentDocs, ownDocs, managedDocs] = await Promise.all([
    Promise.all(recruitments.docs.map(row => recruitmentReceipt(row, ctx))),
    Promise.all(own.docs.map(row => ownApplicationReceipt(row, ctx))),
    Promise.all(managed.docs.map(async row => await ctx.manages(row.id) ? { ...teamReceipt(row), actions: { workbench: true } } : null)),
  ]);
  return { recruitments: pageResult(recruitments, recruitmentDocs), ownApplications: pageResult(own, ownDocs),
    memberships: pageResult(members, members.docs.map(row => membershipReceipt(row, ctx.user))),
    managedTeams: pageResult(managed, managedDocs.filter(row => row !== null)), proposalGames: proposals,
    actions: { establish: proposals.length > 0, reviewEstablishments: canPublish(ctx.user) } };
}
async function workbench(ctx: Context, id: number, query: URLSearchParams) {
  if (!(await ctx.manages(id))) throw new APIError("无权管理此社群的代表队", 403);
  const team = await ctx.p.findByID({ collection: "teams", id, user: null, overrideAccess: false, draft: false, depth: 0, select: teamSelect });
  const status = query.get("status") ?? "pending";
  if (!["pending", "returned", "approved", "rejected", "withdrawn"].includes(status)) throw new APIError("审核状态无效", 400);
  const [established, batches, applications, members] = await Promise.all([
    ctx.isEstablished(id),
    ctx.p.find({ collection: "team-recruitments", user: ctx.user, overrideAccess: false, depth: 0, limit: 20, page: pageNumber(query, "batchesPage"),
      sort: "-createdAt", where: { team: { equals: id } }, select: recruitmentSelect }),
    ctx.p.find({ collection: "team-join-applications", user: ctx.user, overrideAccess: false, depth: 0, limit: 20, page: pageNumber(query),
      sort: "createdAt", where: { and: [{ team: { equals: id } }, { status: { equals: status } }, { status: { not_equals: "draft" } }] } }),
    ctx.p.find({ collection: "team-memberships", user: ctx.user, overrideAccess: false, depth: 0, limit: 20, page: pageNumber(query, "membersPage"),
      sort: "-joinedAt", where: { team: { equals: id } }, select: membershipSelect }),
  ]);
  const docs = await Promise.all(applications.docs.map(async row => {
    let decisions: string[] = [];
    if (row.status === "pending") {
      const [applicant, batch] = await Promise.all([
        currentTeamActor(ctx.p, { id: teamID(row.applicant) }),
        ctx.p.findByID({ collection: "team-recruitments", id: teamID(row.recruitment), user: ctx.user, overrideAccess: false, depth: 0, select: { status: true } }),
      ]);
      decisions = [...(established && batch.status !== "archived" && canUseCampus(applicant) ? ["approved"] : []), "returned", "rejected"];
    }
    return { ...teamJoinReceipt(row), actions: { reviewDecisions: decisions } };
  }));
  return { team: teamReceipt(team), actions: { createRecruitment: established,
    lifecycleStatuses: team.establishmentApplication && (!(team.teamStatus === "archived" || team.archived === true) || canPublish(ctx.user))
      ? ["active", "resting", "archived"].filter(status => status !== team.teamStatus) : [] },
    recruitments: pageResult(batches, await Promise.all(batches.docs.map(row => recruitmentReceipt(row, ctx, true)))),
    applications: pageResult(applications, docs), members: pageResult(members, members.docs.map(row => membershipReceipt(row, ctx.user, true))) };
}

export async function miniappTeamGET(p: Payload, request: Request, path: string) {
  const ctx = await context(p, request), query = new URL(request.url).searchParams;
  if (path === "team") return hub(ctx, query);
  if (path === "team/establishments") return establishments(ctx, query);
  const recruitment = recruitmentPath.exec(path);
  if (recruitment) {
    const id = teamID(recruitment[1]), info = await ctx.info(id);
    if (!info) throw new APIError("招新批次不存在或当前不可读取", 404);
    const team = teamID(info.doc.team), [actions, member] = await Promise.all([recruitmentActions(ctx, id), ctx.membership(team)]);
    return { title: info.doc.title, teamID: team, recruitmentID: id, state: info.state, form: info.form, version: info.version,
      application: teamJoinReceipt(info.own), actions, membership: member ? membershipReceipt(member, ctx.user) : null,
      readOnly: Boolean(info.readOnly), readonly: Boolean(info.readOnly) || !actions.draft && !actions.submit,
      historyNote: info.readOnly ? "此回执展示本人原提交的表单快照；当前批次不可读取，历史申请只读。" : "" };
  }
  const workspace = workbenchPath.exec(path);
  if (workspace) return workbench(ctx, teamID(workspace[1]), query);
  throw new APIError("接口不存在", 404);
}
