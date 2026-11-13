import type { Locale } from "./locale";

/*
 * English display labels for server-side Chinese label maps used by the account,
 * join and community pages. Keys are stable status/kind keys; the Chinese source
 * maps stay the server contract and the fallback.
 */
export const applicationLabelsEn: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved, community opened",
  returned: "Returned for changes",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const promotionKindLabelsEn: Record<string, string> = { event: "Event", notice: "Notice", showcase: "Showcase" };

export const promotionStatusLabelsEn: Record<string, string> = {
  pending: "Pending review",
  returned: "Returned",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  approved: "Promoted",
  demoted: "Demoted",
  needsReview: "Edited, awaiting re-review",
};

export const staffDepartmentsEn: Record<string, string> = {
  execution: "Operations Dept.",
  publicity: "Publicity Dept.",
  both: "Operations or Publicity",
};

export const staffStatusLabelsEn: Record<string, string> = {
  submitted: "Submitted",
  reviewing: "Under review",
  returned: "Needs more info",
  accepted: "Accepted",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

export const audienceLabelsEn: Record<string, string> = {
  campus: "Tsinghua only",
  peer: "Tsinghua and partner schools",
  public: "Everyone",
};

export const affiliationLabelsEn: Record<string, string> = {
  tsinghua: "Tsinghua user",
  peer: "Partner-school student",
  external: "External",
};

/** Chinese label text (as returned by the server) to English, for labels without a stable key. */
const byChinese: Record<string, string> = {
  // staff batch availability (staff-recruitment-model.ts)
  尚未发布: "Not published",
  申请已关闭: "Applications closed",
  申请尚未开始: "Applications not open yet",
  申请已截止: "Applications closed",
  申请开放: "Applications open",
  // staff departments (stored as Chinese option values)
  执行部: "Operations Dept.",
  宣传部: "Publicity Dept.",
  "执行/宣传均可": "Operations or Publicity",
  // roles
  社长: "President",
  副社长: "Vice President",
  骨干: "Staff",
  荣誉骨干: "Honorary staff",
  社群管理员: "Community admin",
  成员: "Member",
  社员: "Member",
  // promotion statuses / kinds
  待审核: "Pending review",
  已退回: "Returned",
  已拒绝: "Rejected",
  已撤回: "Withdrawn",
  已升推: "Promoted",
  已降级: "Demoted",
  改稿待复审: "Edited, awaiting re-review",
  活动: "Event",
  公告: "Notice",
  风采: "Showcase",
  // application statuses
  已批准并开放社群: "Approved, community opened",
  退回补充: "Returned for changes",
  // staff statuses
  已提交: "Submitted",
  选拔处理中: "Under review",
  待补充: "Needs more info",
  已录用: "Accepted",
  未录用: "Not accepted",
  // audience / affiliation
  仅清华: "Tsinghua only",
  清华和友校: "Tsinghua and partner schools",
  所有人: "Everyone",
  清华用户: "Tsinghua user",
  友校学生: "Partner-school student",
  校外人士: "External",
};

/** Label by stable key, with the Chinese label as fallback. */
export function keyedLabel(locale: Locale, key: string | null | undefined, en: Record<string, string>, zh: string): string {
  return locale === "en" && key && en[key] ? en[key] : zh;
}

/** Translate a server-supplied Chinese label; unknown labels stay Chinese. */
export function accountLabel(label: string, locale: Locale): string {
  if (locale !== "en" || typeof label !== "string") return label;
  return byChinese[label.trim()] ?? label;
}
