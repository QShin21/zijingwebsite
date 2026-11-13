import type { Locale } from "./locale";

/*
 * English display labels for Chinese labels produced by the V2 read projections
 * (src/lib/v2) and the activity pages. The projections keep their Chinese contract
 * (the mini program and tests rely on it); the website maps them for display only.
 * Stable keys are preferred where the projection carries one; otherwise the Chinese
 * label is looked up here and falls back to itself.
 */
const byChinese: Record<string, string> = {
  // event lifecycle (src/lib/v2/events.ts stateKeys) and moderation
  即将开始: "Upcoming",
  进行中: "Live",
  已结束: "Ended",
  已取消: "Cancelled",
  已延期: "Postponed",
  已隐藏: "Hidden",
  // event categories (CMS select options)
  比赛: "Match",
  观赛: "Watch party",
  交流: "Meetup",
  训练: "Training",
  其他: "Other",
  // sign-up windows (signupState / registrationState)
  报名开放: "Sign-up open",
  报名尚未开始: "Sign-up not open yet",
  尚未开始: "Not open yet",
  报名已截止: "Sign-up closed",
  已截止: "Deadline passed",
  报名已关闭: "Sign-up closed",
  已关闭: "Closed",
  未启用报名: "No sign-up",
  暂无报名渠道: "No sign-up channel",
  查看报名说明: "See sign-up details",
  // article kinds and news types
  公告: "Notice",
  社群通知: "Community notice",
  影像: "Gallery",
  新闻: "News",
  回顾: "Recap",
  人物故事: "Profile",
  // team lifecycle
  尚未批准成立: "Not yet approved",
  活跃: "Active",
  休整: "Resting",
  已归档: "Archived",
  // team / staff recruitment windows
  招新开放: "Recruiting",
  招新尚未开始: "Not open yet",
  招新已截止: "Deadline passed",
  招新已关闭: "Recruitment closed",
  尚未发布: "Not published",
  申请开放: "Applications open",
  申请尚未开始: "Applications not open yet",
  申请已截止: "Applications closed",
  申请已关闭: "Applications closed",
  // application statuses (team, staff, community)
  草稿: "Draft",
  待人工审核: "Pending review",
  退回补充: "Returned for changes",
  未通过: "Not approved",
  已撤回: "Withdrawn",
  已批准: "Approved",
  已提交: "Submitted",
  选拔处理中: "Under review",
  待补充: "Needs more info",
  已录用: "Accepted",
  未录用: "Not accepted",
  待审核: "Pending review",
  已批准并开放社群: "Approved, community opened",
  已拒绝: "Rejected",
  已退回: "Returned",
  处理中: "In progress",
  // application categories and progress steps (src/lib/v2/account.ts)
  骨干招新: "Staff recruitment",
  骨干申请: "Staff application",
  入队申请: "Team application",
  建队申请: "Team founding",
  社群管理员申请: "Community admin application",
  申请记录: "Application",
  审核中: "In review",
  结果: "Result",
  "查看反馈，按要求补充后重新提交。": "Read the feedback, add what is requested and resubmit.",
  "已录用；平台角色与任职由负责人另行处理。": "Accepted. Platform roles and positions are handled separately by the lead.",
  "查看自己的申请、处理意见与回执。": "View your application, feedback and receipt.",
  "申请仍为草稿，核对后提交人工选拔。": "This application is still a draft. Check it and submit it for selection.",
  "查看审核意见，补充资料后重新提交。": "Read the review notes, add the details and resubmit.",
  "录取结果与成员关系以实际回执为准。": "Results and membership follow the actual receipt.",
  "补充建队资料后重新提交。": "Add the team details and resubmit.",
  "查看建队申请与负责人处理意见。": "View your team application and the lead's notes.",
  "查看反馈，补充申请资料。": "Read the feedback and complete your application.",
  "社群任职独立授权，微信建群与拉群由管理员人工完成。":
    "Community roles are granted separately; WeChat groups are created and joined manually by admins.",
  "查看审核意见，修改荣誉资料后重新提交。": "Read the review notes, edit the honor and resubmit.",
  // management queues (src/lib/v2/account.ts)
  骨干招新申请: "Staff applications",
  代表队荣誉审核: "Team honor review",
  社群升推审核: "Community promotion review",
  社群风采审核: "Community showcase review",
  活动问卷工作台: "Activity questionnaires",
  内容管理后台: "CMS admin",
  全部社群: "All communities",
  已授权社群: "Authorized communities",
  全部骨干批次: "All staff batches",
  全部活动: "All activities",
  本人及已授权活动: "Your own and authorized activities",
  社团内容: "Club content",
  授权范围内的草稿: "Drafts within your scope",
  // fixed page fallbacks (src/lib/v2/pages.ts)
  关于紫荆: "About Zijing",
  联系紫荆: "Contact Zijing",
  隐私说明: "Privacy",
  加入紫荆: "Join Zijing",
  加入社群: "Join a community",
  代表队选拔: "Team tryouts",
  紫荆: "Zijing",
  // legacy collection names and join kinds (src/lib/content.ts names, src/lib/presentation.ts kindLabels)
  活动: "Events",
  代表队: "Teams",
  荣誉档案: "Honor archive",
  动态: "Updates",
  招新批次: "Recruitment rounds",
  通知: "Notices",
  普通社员: "Members",
  紫荆电竞: "Zijing Esports",
};

const patterns: [RegExp, (...groups: string[]) => string][] = [
  [/^待处理 (\d+) 项。$/, (n) => `${n} pending.`],
];

/** English for a Chinese label returned by the server; unknown labels stay Chinese. */
export function publicLabel(label: string | null | undefined, locale: Locale): string {
  if (typeof label !== "string") return "";
  if (locale !== "en" || !label) return label;
  const trimmed = label.trim();
  if (byChinese[trimmed]) return byChinese[trimmed];
  for (const [pattern, render] of patterns) {
    const match = pattern.exec(trimmed);
    if (match) return render(...match.slice(1));
  }
  return label;
}

const eventStatesEn: Record<string, string> = {
  upcoming: "Upcoming",
  live: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
  postponed: "Postponed",
};
/** Event lifecycle chip; the moderation label "已隐藏" overrides the state key. */
export function eventStateLabel(state: string, label: string, locale: Locale): string {
  if (locale !== "en") return label;
  if (byChinese[label]) return byChinese[label];
  return eventStatesEn[state] ?? label;
}

const signupStatesEn: Record<string, string> = {
  open: "Sign-up open",
  notStarted: "Sign-up not open yet",
  deadlinePassed: "Sign-up closed",
  closed: "Sign-up closed",
};
export function signupStateLabel(state: string, label: string, locale: Locale): string {
  if (locale !== "en") return label;
  return byChinese[label] ?? signupStatesEn[state] ?? label;
}

const recruitmentStatesEn: Record<string, string> = { open: "Open", upcoming: "Not open yet", closed: "Closed" };
export function recruitmentStateLabel(state: string, label: string, locale: Locale): string {
  if (locale !== "en") return label;
  return byChinese[label] ?? recruitmentStatesEn[state] ?? label;
}

const teamStatusesEn: Record<string, string> = {
  unestablished: "Not yet approved",
  active: "Active",
  resting: "Resting",
  archived: "Archived",
};
export function teamStatusLabel(status: string, label: string, locale: Locale): string {
  if (locale !== "en") return label;
  return teamStatusesEn[status] ?? byChinese[label] ?? label;
}

const articleKindsEn: Record<string, string> = {
  announcement: "Notice",
  communityNotice: "Community notice",
  album: "Gallery",
};
/** Article chip: announcement/communityNotice/album are keyed; news uses the CMS type option. */
export function articleLabel(kind: string, label: string, locale: Locale): string {
  if (locale !== "en") return label;
  return articleKindsEn[kind] ?? byChinese[label] ?? label;
}
