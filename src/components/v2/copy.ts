// Empty-state and guidance copy (REBUILD_V2_PRODUCT_DESIGN §8). One source for web pages.
import type { Translate } from "@/lib/i18n/locale";

const chinese: Translate = (zh) => zh;

/** Localized empty-state copy; pass the `t` from getT()/useT(). */
export function emptyCopy(t: Translate) {
  return {
    weekEvents: {
      title: t("近期暂无安排", "Nothing scheduled soon"),
      body: t("新的活动确认后会出现在这里，可以先看看公告或浏览社群。", "New events appear here once confirmed. Meanwhile, check the notices or browse communities."),
    },
    filtered: {
      title: t("没有符合条件的活动", "No matching events"),
      body: t("换一个筛选条件，或清除筛选查看全部安排。", "Try another filter, or clear the filters to see everything."),
    },
    mySignups: {
      title: t("还没有报名记录", "No sign-ups yet"),
      body: t("报名开放的活动会标注「报名开放」。", "Events taking sign-ups are marked “Sign-up open”."),
    },
    communities: {
      title: t("社群正在筹备", "Communities are on the way"),
      body: t("想把自己的游戏组织成社群，可以提交组织申请。", "Want to start a community for your game? Submit an application."),
    },
    showcase: {
      title: t("还没有风采", "No showcase posts yet"),
      body: t("社群成员的高光时刻经管理员审核后展示在这里。", "Members' highlights appear here after admin review."),
    },
    contacts: {
      title: t("暂无可展示的管理员名片", "No admin contacts to show"),
      body: t("在任管理员同意展示名片后才会出现在这里。", "Admin contact cards appear here once the admins agree to share them."),
    },
    roster: {
      title: t("暂无公开的队员简介", "No public player profiles"),
      body: t("现任队员可以编辑并选择公开本人简介。", "Current players can edit their profiles and choose to make them public."),
    },
    honors: {
      title: t("暂无已核验的荣誉", "No verified honors yet"),
      body: t("现任队员可以投稿比赛荣誉，经审核后上墙。", "Current players can submit match honors; they appear after review."),
    },
    recruitment: {
      title: t("当前没有开放批次", "No open rounds right now"),
      body: t("可以先浏览代表队与骨干招新的往期安排。", "Browse past team tryouts and staff recruitment in the meantime."),
    },
    todo: {
      title: t("暂时没有需要处理的事项", "Nothing to do right now"),
      body: t("去日程看看最近的活动吧。", "Check the schedule for upcoming events."),
    },
    queuesDone: t("已全部处理", "All done"),
    notices: {
      title: t("暂无公告", "No notices yet"),
      body: t("确认后的社团公告会在这里发布。", "Confirmed club notices will be posted here."),
    },
    feed: {
      title: t("动态正在路上", "Updates are on the way"),
      body: t("公告、社群通知、新闻、影像、风采与荣誉都会汇总在这里。", "Notices, community news, articles, galleries, showcase posts and honors all gather here."),
    },
  };
}
/** Chinese copy for callers that have not adopted emptyCopy(t) yet. */
export const empty = emptyCopy(chinese);

export function joinPathsCopy(t: Translate) {
  return [
    {
      key: "members",
      title: t("加入游戏社群", "Join a game community"),
      body: t(
        "选择社群，查看在任管理员名片，在微信添加好友后由管理员人工邀请进群。",
        "Pick a community, view its admins' contact cards, add one on WeChat and an admin will invite you to the group.",
      ),
      steps: [t("选社群", "Pick a community"), t("联系管理员", "Contact an admin"), t("人工拉群", "Get invited")],
      href: "/community",
      action: t("浏览游戏社群", "Browse communities"),
    },
    {
      key: "teams",
      title: t("参加代表队选拔", "Try out for a team"),
      body: t("在选拔中心选择开放的批次，填写申请后由社群管理员人工选拔。", "Choose an open round in the tryout center and apply; community admins select players."),
      steps: [t("选批次", "Pick a round"), t("填写申请", "Apply"), t("人工选拔", "Selection")],
      href: "/teams/recruitment",
      action: t("进入选拔中心", "Open tryout center"),
    },
    {
      key: "staff",
      title: t("参与骨干工作", "Join the staff"),
      body: t(
        "执行部与宣传部按批次招新，提交申请后可随时查看本人回执与进度。",
        "The operations and publicity departments recruit in rounds; after applying you can check your receipt and progress anytime.",
      ),
      steps: [t("选批次", "Pick a round"), t("提交申请", "Apply"), t("查看回执", "Check receipt")],
      href: "/join/staff",
      action: t("查看骨干招新", "View staff recruitment"),
    },
  ] as const;
}
/** Chinese copy for callers that have not adopted joinPathsCopy(t) yet. */
export const joinPaths = joinPathsCopy(chinese);

export function memberOnlyCopy(t: Translate) {
  return t("登录后可查看游戏社群、代表队与完整动态。", "Sign in to see game communities, teams and all updates.");
}
export const memberOnly = memberOnlyCopy(chinese);
