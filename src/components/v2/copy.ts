// Empty-state and guidance copy (REBUILD_V2_PRODUCT_DESIGN §8). One source for web pages.
export const empty = {
  weekEvents: { title: "近期暂无安排", body: "新的活动确认后会出现在这里，可以先看看公告或浏览社群。" },
  filtered: { title: "没有符合条件的活动", body: "换一个筛选条件，或清除筛选查看全部安排。" },
  mySignups: { title: "还没有报名记录", body: "报名开放的活动会标注「报名开放」。" },
  communities: { title: "社群正在筹备", body: "想把自己的游戏组织成社群，可以提交组织申请。" },
  showcase: { title: "还没有风采", body: "社群成员的高光时刻经管理员审核后展示在这里。" },
  contacts: { title: "暂无可展示的管理员名片", body: "在任管理员同意展示名片后才会出现在这里。" },
  roster: { title: "暂无公开的队员简介", body: "现任队员可以编辑并选择公开本人简介。" },
  honors: { title: "暂无已核验的荣誉", body: "现任队员可以投稿比赛荣誉，经审核后上墙。" },
  recruitment: { title: "当前没有开放批次", body: "可以先浏览代表队与骨干招新的往期安排。" },
  todo: { title: "暂时没有需要处理的事项", body: "去日程看看最近的活动吧。" },
  queuesDone: "已全部处理",
  notices: { title: "暂无公告", body: "确认后的社团公告会在这里发布。" },
  feed: { title: "动态正在路上", body: "公告、社群通知、新闻、影像、风采与荣誉都会汇总在这里。" },
} as const;

export const joinPaths = [
  {
    key: "members",
    title: "加入游戏社群",
    body: "选择社群，查看在任管理员名片，在微信添加好友后由管理员人工邀请进群。",
    steps: ["选社群", "联系管理员", "人工拉群"],
    href: "/community",
    action: "浏览游戏社群",
  },
  {
    key: "teams",
    title: "参加代表队选拔",
    body: "在选拔中心选择开放的批次，填写申请后由社群管理员人工选拔。",
    steps: ["选批次", "填写申请", "人工选拔"],
    href: "/teams/recruitment",
    action: "进入选拔中心",
  },
  {
    key: "staff",
    title: "参与骨干工作",
    body: "执行部与宣传部按批次招新，提交申请后可随时查看本人回执与进度。",
    steps: ["选批次", "提交申请", "查看回执"],
    href: "/join/staff",
    action: "查看骨干招新",
  },
] as const;

export const memberOnly = "登录后可查看游戏社群、代表队与完整动态。";
