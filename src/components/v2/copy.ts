// Empty-state and guidance copy (REBUILD_V2_PRODUCT_DESIGN §8). One source for web pages.
export const empty = {
  weekEvents: { title: "近期暂无安排", body: "可以先浏览公告或游戏社群。" },
  filtered: { title: "没有符合条件的活动", body: "换一个筛选条件，或清除筛选查看全部安排。" },
  mySignups: { title: "还没有报名记录", body: "选择「报名开放」的活动，查看报名方式。" },
  communities: { title: "社群正在筹备", body: "想把自己的游戏组织成社群，可以提交组织申请。" },
  showcase: { title: "还没有风采", body: "社群成员可投稿，管理员审核后公开。" },
  contacts: { title: "暂无可展示的管理员名片", body: "管理员需本人授权后公开名片。" },
  roster: { title: "暂无公开的队员简介", body: "现任队员可以编辑并选择公开本人简介。" },
  honors: { title: "暂无已核验的荣誉", body: "现任队员可以投稿比赛荣誉，经审核后上墙。" },
  recruitment: { title: "当前没有开放批次", body: "可以先浏览代表队与骨干招新的往期安排。" },
  todo: { title: "暂时没有需要处理的事项", body: "去日程看看最近的活动吧。" },
  queuesDone: "已全部处理",
  notices: { title: "暂无公告", body: "暂未发布社团公告。" },
  feed: { title: "暂无动态", body: "可以先浏览游戏社群。" },
} as const;

export const joinPaths = [
  {
    key: "members",
    title: "加入游戏社群",
    body: "选择社群，联系在任管理员，由管理员邀请进群。",
    steps: ["选社群", "联系管理员", "人工拉群"],
    href: "/community",
    action: "浏览游戏社群",
  },
  {
    key: "teams",
    title: "参加代表队选拔",
    body: "选择开放批次，填写申请，等待管理员选拔。",
    steps: ["选批次", "填写申请", "人工选拔"],
    href: "/teams/recruitment",
    action: "进入选拔中心",
  },
  {
    key: "staff",
    title: "参与骨干工作",
    body: "申请执行部或宣传部岗位，提交后查看回执与进度。",
    steps: ["选批次", "提交申请", "查看回执"],
    href: "/join/staff",
    action: "查看骨干招新",
  },
] as const;

export const memberOnly = "登录后可查看游戏社群、代表队与完整动态。";
