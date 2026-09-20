export type Identity = {
  id: number | string;
  roles?: string[] | null;
  teams?: (number | string | { id: number | string })[] | null;
};
export const hasRole = (
  user: Identity | null | undefined,
  ...roles: string[]
) => Boolean(user?.roles?.some((role) => roles.includes(role)));
export const canPublish = (user: Identity | null | undefined) =>
  hasRole(user, "admin", "publisher");
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
};
