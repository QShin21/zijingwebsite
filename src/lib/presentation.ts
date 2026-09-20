import { safeURL } from "./rules";

export const sectionMeta: Record<string, { label: string; title: string; description: string }> = {
  events: { label: "WHAT'S ON", title: "下一场，一起。", description: "比赛、观赛、交流与训练。找到想参加的活动，也回看那些值得记住的现场。" },
  teams: { label: "OUR TEAMS", title: "并肩，向更高处。", description: "了解代表队，查看赛季阵容与选拔信息。" },
  honors: { label: "HALL OF HONOR", title: "每一步，都算数。", description: "赛事、成绩与共同走过的赛季，保存在这里。" },
  news: { label: "CLUB JOURNAL", title: "赛场之外，同样精彩。", description: "社团公告、活动回顾，以及关于热爱的故事。" },
  albums: { label: "IN THE FRAME", title: "把这一刻，留下。", description: "从赛场到日常，在影像里重新相遇。" },
  recruitment: { label: "OPEN CALL", title: "下一段故事，等你加入。", description: "查看各轮招新的要求、安排与报名渠道。" },
};
export const kindLabels: Record<string, string> = { members: "普通社员", teams: "代表队选拔", staff: "骨干招新" };
/** Only root-relative local links or credential-free HTTPS destinations. */
export function publicHref(value: unknown, fallback: string): string {
  if (typeof value !== "string" || /[\s\\\u0000-\u001f]/.test(value)) return fallback;
  return (/^\/(?!\/)/.test(value) || safeURL(value)) ? value : fallback;
}
export function dateParts(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const parts = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (key: string) => parts.find((p) => p.type === key)?.value || "";
  return { year: get("year"), month: get("month"), day: get("day") };
}
