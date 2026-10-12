# 小程序代表队只读投影合同 · 2026-10-12

源码依赖为队伍核心 `5f28f95377e9ea4fbf6e4afc54b6cb88e969d33a` 及最终历史修复 `bf6665c57d83ffa269845c76ff6903d23e0510de`（本分支对应 cherry-pick `9dc3bb6`，无新增迁移）。核心业务合同见 [TEAM_CORE_20261012.md](TEAM_CORE_20261012.md)。本兼容层只新增 GET，所有写操作继续使用 `POST /api/team-core`，不新增成员表、业务状态或状态转换服务。

每个 GET 都要求当前可用账号，使用认证结果的 ID 重新读取账号、角色和社群任职。私人 Local API 保留 `overrideAccess:false`、`depth:0`；本人查询同时加明确 applicant/member 条件。响应保持 `Cache-Control: private, no-store`。客户端直接使用服务器 actions 展示按钮；actions 是当前可见性提示，既有写服务会再次验证权限、窗口、版本和修订。

所有分页对象统一为 `{docs,page,totalPages,totalDocs,hasNextPage}`；每块独立分页，默认 20 条，页码取 1–10000 的整数。所有 ID 为正整数。关系仅返回对应 ID，剔除 requestKey、membershipKey、授权操作者、关联邮箱及未授权人员资料。

## GET /api/miniapp/team

参数：`page`（批次）、`ownPage`（本人申请）、`membersPage`（本人成员关系）、`teamsPage`（可管理队伍）。

```ts
{
  recruitments: Page<Recruitment>,
  ownApplications: Page<OwnApplication>,
  memberships: Page<Membership>,
  managedTeams: Page<ManagedTeam>,
  proposalGames: {id: number, title: string, actions: {establish: true}}[],
  actions: {establish: boolean, reviewEstablishments: boolean}
}
```

`recruitments` 仅查 `open/closed/archived`，继续经过集合访问控制，不在 hub 展示管理草稿。本人记录不因批次、队伍归档而丢失；列表不读取隐藏批次配置。本人申请 `edit/withdraw` 同取详情服务动作，历史只读或核心拒绝读取时均为 false，不能按列表 status 恢复按钮。可管理队伍使用当前 `canManageTeam`，可建队社群使用当前 `canProposeTeam`，均过滤未发布或已归档的游戏社群。

```ts
type Recruitment = {
  id: number, title: string, teamID: number, gameID: number,
  status: string, state: string, startAt: string, endAt: string,
  updatedAt: string,
  actions: {view: boolean, apply: boolean, workbench: boolean}
};
type OwnApplication = {
  id: number, title: string, status: string, teamID: number,
  recruitmentID: number, createdAt: string, updatedAt: string,
  reviewNote: string | null,
  actions: {view: boolean, edit: boolean, withdraw: boolean}
};
type Membership = {
  id: number, title: string, teamID: number, gameID: number,
  status: 'active' | 'revoked', joinedAt: string,
  revokedAt: string | null, leftAt: string | null, updatedAt: string,
  actions: {leave: boolean}
};
type ManagedTeam = {
  id: number, title: string, gameID: number,
  teamStatus: string, updatedAt: string,
  actions: {workbench: true}
};
```

## GET /api/miniapp/team/recruitment/:id

```ts
{
  title: string, teamID: number, recruitmentID: number,
  state: string, form: SignupForm, version: string,
  application: TeamJoinReceipt | null,
  actions: {
    draft: boolean, submit: boolean, edit: boolean,
    withdraw: boolean, review: boolean, workbench: boolean
  },
  membership: Membership | null,
  readOnly: boolean,
  readonly: boolean,
  historyNote: string
}
```

`form/version/state/application` 复用 `teamRecruitmentInfo` 与 `teamJoinReceipt`。保留全部 16 类表单、分支、题目 ID 和原提交版本。`edit` 表示已有申请可进入改稿；`draft/submit` 表示可保存草稿/提交表单。截止、关闭、归档、已有最终结果或当前在队关系会禁用对应保存/提交提示；当前批次仍可读取时，未完成审核的申请在截止后保留撤回提示。最终写校验由核心服务执行。

`membership` 只查本人权威关系，包含当前修订和服务器 `actions.leave`；归档后仍可本人离队。客户端不能使用旧阵容、账号 teams 或公开简介推断资格。

最终核心先通过本人 applicant 条件与 ACL 读取原申请，再通过 ACL 尝试读当前批次。隐藏批次或归档队伍导致批次不可读取时，核心只返回本人旧 `formSnapshot`：`doc` 仅含 id/title/team/game，`form.enabled=false`、`form.closed=true`，`version=own.formVersion`，`state='历史申请只读'`，`readOnly=true`。无本人申请时仍为 404。兼容层原样复用此结果，不补查隐藏表单、不绕过 ACL，也不自行生成历史题目。

`readOnly` 表示核心明确的历史快照回退。该值优先遮蔽全部 draft/submit/edit/withdraw/review/workbench 动作，判定前不会读取当前批次配置、跨批次申请或额外管理能力；`readonly` 还包含当前窗口不可保存/提交的普通回执。历史 `historyNote` 为“此回执展示本人原提交的表单快照；当前批次不可读取，历史申请只读。”。本人有效成员关系的 `actions.leave` 独立保留，历史只读不会生成第二份成员名单。

## GET /api/miniapp/team/establishments

参数：`mode=own|review`（默认 own）、`page`。

返回分页对象，另含 `proposalGames` 和顶层 `actions:{establish,reviewEstablishments}`。每条 doc：

```ts
{
  id: number, title: string, gameID: number, reason: string,
  status: string, teamID: number | null,
  createdAt: string, updatedAt: string, reviewNote: string | null,
  actions: {
    edit: boolean, withdraw: boolean,
    reviewDecisions: ('approved' | 'returned' | 'rejected')[]
  }
}
```

本人列表明确限制 applicant，修改重提提示使用当前 `canProposeTeam`。review 模式先检查当前 `canPublish`，仅查 pending。批准提示还检查发布社群及申请者当前任职；撤权后仍可由授权审核人退回/拒绝。普通社群管理员不能读取其他建队申请。

## GET /api/miniapp/team/:id/workbench

参数：`page`（入队申请）、`membersPage`（成员关系）、`batchesPage`（批次）、`status`（申请状态，默认 pending；允许 pending/returned/approved/rejected/withdrawn）。

先验证当前 `canManageTeam`，无权限返回 403，再读取各段私人资料；队伍自身继续使用已发布内容 ACL。返回：

```ts
{
  team: {id: number, title: string, gameID: number, teamStatus: string, updatedAt: string},
  actions: {createRecruitment: boolean, lifecycleStatuses: ('active' | 'resting' | 'archived')[]},
  recruitments: Page<Recruitment>,
  applications: Page<TeamJoinReceipt>,
  members: Page<Membership>
}
```

工作台 `recruitments` 允许当前管理范围内的 draft，追加 `actions:{edit,close,archive}`。`applications` 每条是核心 `teamJoinReceipt`，追加 `actions:{reviewDecisions}`，始终排除 draft；批准提示检查队伍成立、批次非归档及申请者可用，截止/关闭后仍可审核已提交版本。`members` 来自唯一权威 `team-memberships`，追加 `memberID` 和 `actions.revoke`；不返回原始申请答案、联系方式或关系唯一键。非管理人不能取得本队私人名单。

运营状态动作与最终核心使用相同的双归档信号：teamStatus 为 archived 或 archived 为 true 时，普通社群管理人不能恢复队伍；恢复能力仍要求既有 canPublish。archived 仅用于服务器内部判定，不增加公开队伍字段。

## 原写入口与 ID

| 流程 | POST /api/team-core 的 operation | ID/主要输入 |
| --- | --- | --- |
| 建队/修改重提 | establish | gameID/title/reason；改稿含 id/revision |
| 撤回建队 | withdraw-establishment | id=建队申请 ID、revision |
| 审核建队 | decide-establishment | id/decision/note/revision |
| 保存入队草稿/提交 | save-join | id=招新批次 ID、action=draft/submit、version/revision/answers |
| 撤回入队申请 | withdraw-join | id=入队申请 ID、revision |
| 审核入队 | decide-join | id=入队申请 ID、decision/note/revision；seasonID 选填 |
| 本人离队/管理撤销 | leave / revoke | id=成员关系 ID、revision/note |
| 管理队伍/招新 | lifecycle / save-recruitment / close-recruitment | 沿用核心合同字段，不包装新状态机 |

所有写成功后重新读取相应 GET，刷新修订及动作。真实微信 SDK、模拟器、合法域名、真机和审核发布验证不属于服务端合成契约测试结果。

## 验收状态

四个 GET 已实现，写入口保持原状。2026-10-12 首个切片实际通过 14 项新合成契约测试、17 项社群兼容测试与 7 项既有身份测试；随后加入停用候选人负向断言，14 项复跑通过。`pnpm typecheck` 与三个目标文件 ESLint 通过。测试使用合成数据和模拟 Local API，直接调用现有权限辅助函数；`teamRecruitmentInfo` 为受控叶子 mock。此结果不代替真实数据库 HTTP 或微信环境联测。

最终历史契约已按上述 SHA 接入并补齐合成验收。21 项队伍只读 API 测试通过，新增 hidden draft/pending/returned 快照、readOnly 优先、hub 禁止恢复撤回以及两种归档字段组合的负向病例；保留原权限、分页、草稿保护和 16 类表单断言。与 21 项骨干审核生命周期测试及 28 项原骨干流程回归合跑，70 项通过；目标 ESLint 与整体 `pnpm typecheck` 通过。核心 info 在此套件中仍为受控叶子 mock；真实 SQL HTTP 历史用例由主集成者单独验收，本段不将模拟 Local API 等同真实数据库或微信联测。无生产操作、正式上传、审核或真实通知。

## 原生荣誉档案只读消费者

原生页为 `pages/team-honors/index`，入口参数 `{team: id}`。消费者参考上游实际源码 `397d6092e11c5b29a91916a5fead339c1a5602c4` 的 `GET /api/team-honor-archives/:team`、PublicHonor/Archive DTO 与受控证据视频路由。此 SHA 用于 HTTP 结构核对；荣誉后端及随后安全修复尚未集成当前小程序分支，不能视为当前分支的真实 HTTP 联测或最终安全交付。上游已报告公开原始 videoURL 的隔离问题并正在修复，最终安全 SHA 待集成者记录。

`miniprogram/src/lib/team-honor.js` 使用既有 HTTP 的 `{auth:false,raw:true}`；校验归档 team.id 与当前路由匹配，保留服务返回的记录顺序与赛事原文。只投影公开文字、图片说明、legacy 和受控 href；原始 videoURL、membershipRef、reviewNote/history 等不进入页面数据或存储，也不作为视频失败回退。资料均由已审服务投影决定，客户端不生成荣誉事实、成员资格或批准关系。

图片仅接受服务投影的标准 WebP data URI，复用既有 files.localImage 写入本机后预览。视频仅允许 `/api/team-honor-evidence/:recordID/video?version=<64位小写SHA-256>`，recordID 必须与 `team-honor-records:ID` 一致；拼接固定网站 origin，保留原生控制、关闭自动播放。该 version 是荣誉批准内容版本，不能拿视频字节 videoVersion 代替。legacy 不展示图片或视频；`/honors/:slug` 使用既有 navigation.website 转原生历史荣誉原文。

404 呈现可重试空态，不查询私人记录或内部成员 getter 补救；500/断网保留安全重试提示。重复点击保护、队伍/账号变化 ticket、hide/show/unload 和晚到图片清理均在实际 Page/HTTP/session/files 代码中执行；隐藏或刷新停止旧视频，旧 SDK 视频错误不覆盖新版本。

实际验收：12 项合成测试使用真实 Page 与上述 native 模块，通过受控 wx SDK 回调验证匿名请求、WebP 写入/预览、legacy 导航、白名单、原始媒体拒绝、空态、断网、重复点击、队伍/账号变化、晚到媒体清理与视频暂停；与 13 项既有内容流程回归合跑，25 项通过。目标 ESLint 和整体 `pnpm typecheck` 通过。`pnpm miniapp:check` 当前源码静态扫描通过（21 个已注册页面、127 文件、341864 字节、域名校验开启）；该时点荣誉页还待主集成者注册和添加入口，注册后须再检查。此测试没有真实微信 SDK/开发者工具、真机、实际后端 HTTP、上传、审核、正式发布或订阅消息；相应平台与最终服务部署仍需独立验证。

主集成者注册荣誉等页面后，本分支再次执行 `pnpm miniapp:check` 通过：23 页、132 文件、384150 字节，域名校验开启、原生依赖为 0。该结果仍仅是源码静态门禁，荣誉服务最终安全依赖和微信环境验证继续待验收。

本荣誉只读切片未覆盖荣誉投稿、审核和平台发布验证；荣誉最终安全后端 SHA 与写 HTTP 合同仍待主集成者交付、集成及验收。队员简介由独立任务实现和报告，本消费者不据此宣称相关写流程完成。没有新增平台权限或发送通知。
