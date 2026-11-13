import { formatDate } from "@/lib/rules";
import { formatDateTime, type Locale, type Translate } from "@/lib/i18n/locale";
import { teamApplicationLabels, teamLifecycleLabels, teamRecruitmentLabels } from "@/lib/team-core";

/*
 * English display of the team status labels from src/lib/team-core (stable status keys).
 * The Chinese labels stay the source and the fallback.
 */
const applicationEn: Record<string, string> = { draft: "Draft", pending: "Pending review", returned: "Returned for more info", rejected: "Not approved", withdrawn: "Withdrawn", approved: "Approved" };
const recruitmentEn: Record<string, string> = { draft: "Draft", open: "Recruitment open", closed: "Closed", archived: "Archived" };
const lifecycleEn: Record<string, string> = { unestablished: "Not yet approved", active: "Active", resting: "Resting", archived: "Archived" };
/** teamRecruitmentState / teamRecruitmentInfo return Chinese text; map it for display. */
const recruitmentStateEn: Record<string, string> = {
  历史申请只读: "Past application (read-only)",
  队伍未开放招新: "Team is not recruiting",
  招新已关闭: "Recruitment closed",
  招新尚未开始: "Recruitment not yet open",
  招新已截止: "Recruitment ended",
  招新开放: "Recruitment open",
};

export const applicationLabel = (t: Translate, status: string) => t(teamApplicationLabels[status] ?? status, applicationEn[status] ?? "");
export const recruitmentLabel = (t: Translate, status: string) => t(teamRecruitmentLabels[status] ?? status, recruitmentEn[status] ?? "");
export const lifecycleLabel = (t: Translate, status: string) => t(teamLifecycleLabels[status] ?? status, lifecycleEn[status] ?? "");
export const recruitmentStateLabel = (t: Translate, state: string) => t(state, recruitmentStateEn[state] ?? "");
/** Chinese keeps the original rules.formatDate output. */
export const localDate = (value: string | null | undefined, locale: Locale) => (locale === "en" ? formatDateTime(value, "en") || "TBA" : formatDate(value));
