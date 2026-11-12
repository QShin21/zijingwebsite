export type Identity = {
  id: number | string;
  roles?: string[] | null;
  teams?: (number | string | { id: number | string })[] | null;
  communities?: (number | string | { id: number | string })[] | null;
  accountStatus?: string | null;
  department?: string | null;
  communityOffices?: CommunityOffice[] | null;
};
export type CommunityCapability = "publishContent" | "reviewShowcase" | "handleJoins" | "viewSignups" | "exportSignups" | "contactConsent";
export type CommunityOffice = {
  game?: number | string | { id: number | string } | null;
  status?: string | null;
  publishContent?: boolean | null;
  reviewShowcase?: boolean | null;
  handleJoins?: boolean | null;
  viewSignups?: boolean | null;
  exportSignups?: boolean | null;
  contactConsent?: boolean | null;
};
export const relationID = (value: unknown): unknown =>
  value && typeof value === "object" && "id" in value ? value.id : value;
export const hasRole = (
  user: Identity | null | undefined,
  ...roles: string[]
) => Boolean(user?.accountStatus !== "suspended" &&
  user?.roles?.some((role) => roles.includes(role)));
export const canPublish = (user: Identity | null | undefined) =>
  hasRole(user, "president", "vicePresident");
export const canParticipate = (user: Identity | null | undefined) =>
  Boolean(user?.id && user.accountStatus !== "suspended");
export const communityIDs = (user: Identity | null | undefined, capability?: CommunityCapability) =>
  canParticipate(user) ? (user?.communityOffices ?? [])
    .filter(office => office.game != null && office.status === "active" && (!capability || office[capability] === true))
    .map(office => String(relationID(office.game))) : [];
export const hasCommunityOffice = (user: Identity | null | undefined) => communityIDs(user).length > 0;
export const communityCapability = (user: Identity | null | undefined, id: unknown, capability: CommunityCapability) =>
  canPublish(user) || communityIDs(user, capability).includes(String(relationID(id)));
export const managesGame = (user: Identity | null | undefined, id: unknown) =>
  communityCapability(user, id, "publishContent");
export const canReviewShowcase = (user: Identity | null | undefined, id: unknown) => communityCapability(user, id, "reviewShowcase");
export const canReviewCommunityApplication = canPublish;
export const canManageStaffRecruitment = canPublish;
export const canAppoint = (user: Identity | null | undefined) => hasRole(user, "president");
export const canReviewPromotion = (user: Identity | null | undefined) => canPublish(user) || hasRole(user, "backbone");
export const canSubmitClubContent = (user: Identity | null | undefined) =>
  canPublish(user) || hasRole(user, "backbone", "communityAdmin") || communityIDs(user, "publishContent").length > 0;
// Community access is determined by the active office and its individual permissions.
const signupScope = (user: Identity | null | undefined, game: unknown, capability: "viewSignups" | "exportSignups") =>
  relationID(game) == null ? communityIDs(user, capability).length > 0 : communityIDs(user, capability).includes(String(relationID(game)));
export const canReadActivitySignups = (user: Identity | null | undefined, kind: string, game: unknown, organizer: unknown) =>
  canPublish(user) || (kind === "community-posts"
    ? communityIDs(user, "viewSignups").includes(String(relationID(game)))
    : canParticipate(user) && String(relationID(organizer)) === String(user?.id) && signupScope(user, game, "viewSignups"));
export const canExportActivitySignups = (user: Identity | null | undefined, kind: string, game: unknown, organizer: unknown) =>
  canReadActivitySignups(user, kind, game, organizer) && (canPublish(user) || (kind === "community-posts"
    ? communityIDs(user, "exportSignups").includes(String(relationID(game)))
    : signupScope(user, game, "exportSignups")));
export const teamIDs = (user: Identity | null | undefined) =>
  (user?.teams ?? []).map((t) => String(typeof t === "object" ? t.id : t));
export function safeURL(value: unknown): boolean {
  if (typeof value !== "string" || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export type Window = {
  endAt?: string | null;
  _status?: string | null;
  archived?: boolean | null;
  lifecycle?: string | null;
  registrationClosed?: boolean | null;
  registrationStart?: string | null;
  registrationEnd?: string | null;
  registrationURL?: string | null;
  channelText?: string | null;
};
export function registrationState(doc: Window, now = new Date()): string {
  if (
    doc._status !== "published" ||
    doc.archived ||
    doc.registrationClosed ||
    (doc.endAt && now.getTime() >= Date.parse(doc.endAt)) ||
    ["cancelled", "postponed", "ended"].includes(doc.lifecycle ?? "")
  )
    return "已关闭";
  if (!safeURL(doc.registrationURL) && !doc.channelText?.trim())
    return "暂无报名渠道";
  if (
    doc.registrationStart &&
    now.getTime() < Date.parse(doc.registrationStart)
  )
    return "尚未开始";
  if (doc.registrationEnd && now.getTime() >= Date.parse(doc.registrationEnd))
    return "已截止";
  return "报名开放";
}
export function eventState(
  doc: {
    lifecycle?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  },
  now = new Date(),
) {
  if (doc.lifecycle === "cancelled") return "已取消";
  if (doc.lifecycle === "postponed") return "已延期";
  if (
    doc.lifecycle === "ended" ||
    (doc.endAt && now.getTime() >= Date.parse(doc.endAt))
  )
    return "已结束";
  if (doc.startAt && now.getTime() >= Date.parse(doc.startAt)) return "进行中";
  return "即将开始";
}
export function beijingInputTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(Date.parse(value) + 8 * 60 * 60 * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : "";
}

export const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "待公布";
export const routeFor: Record<string, string> = {
  events: "events",
  teams: "teams",
  honors: "honors",
  news: "news",
  albums: "gallery",
  recruitment: "recruitment",
  announcements: "announcements",
};
