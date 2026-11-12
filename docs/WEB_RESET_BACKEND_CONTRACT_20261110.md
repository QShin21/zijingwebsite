# 网页重置：后端兼容合同

## 范围与基线

本轮在 `main@58f0de98b349ab13343780a4e05f2d6d55249cef` 的网页功能上进行视觉与交互重置。后端审查负责接口与业务兼容，不因视觉调整更改数据库结构、角色、发布范围或小程序合同。

静态入口清单在 [`tests/fixtures/web-reset-contract-baseline-20261110.json`](../tests/fixtures/web-reset-contract-baseline-20261110.json)：41 个网页页面入口、18 个 HTTP 路由、5 个 Server Action 模块的 34 个导出动作。`tests/web-reset-contracts.test.ts` 检查原入口和方法仍在，允许新增入口。它不能替代真实行为回归，也不能证明一个按钮或整个流程仍然可用。

本次没有部署、生产数据库操作或真实用户数据读取。`CLAUDE.md` 为本轮开始前已有的未提交文件，后端审查不覆盖它。

## 必须保留的访问边界

- `src/proxy.ts` 与 `src/lib/page-access.ts` 保留原访客范围：`/events`、`/announcements`、`/login`、`/register`、`/account/reset`、`/privacy` 及这些路径的子路径。首页、社群、代表队及其他页面的既有身份要求不得因换皮扩大。
- 公开 CMS Local API 保持 `overrideAccess: false`、`user: null`、`draft: false` 和最小字段投影；草稿、内部备注、待核荣誉与私人报名资料不得落入公开卡片或客户端序列化数据。
- 平台角色、社群任职、队伍任职分别鉴权。可阅读名单不等于可编辑或导出，骨干不自动获得全局发布或私人报名权限。
- 私有数据及预览响应保持 `private, no-store`；既有 CSP、同源写入检查、显式 JWT 与 Cookie 的区分保持。
- 已移除的论坛、聊天、评论、点赞、进群进度不因新导航恢复。相关旧存储仍保留。
- 后端返回的能力字段可决定界面是否显示入口，客户端隐藏按钮不能替代服务端鉴权。

## 功能与接口分组

| 功能 | 现有合同 | 重置时的注意事项 |
|---|---|---|
| 登录、注册、密码找回、退出 | `account/actions.ts` 的 10 个导出动作；邮箱验证码与唯一昵称；`AuthResult` 的 `error` / `success` / `redirect` | 保留字段名、验证码阶段、账号不存在时的统一找回响应、`returnTo` 校验和失败时已填信息。不得把邮箱登录与昵称登录拆成不兼容载荷。 |
| 公共内容、首页、动态、通知、影像、关于、隐私、联系 | `src/lib/content.ts`、CMS、`Site` Global、各页面服务端读取 | 保留 CMS 可配置内容、分页、原 slug 与重定向、SEO、空状态、错误状态、浅深主题与无障碍。不得以虚构社团内容填补数据库空白。 |
| 社群申请、审批、名片、活动/通知发布、风采投稿与审核 | `community/actions.ts`；`/community/[slug]/contacts`；申请 QR 路由；`community/promotions/actions.ts` | 保留对象归属、撤回/退回/重提、发布与审核能力区分、图片版本检查、媒体范围及原结果反馈。联系与注册不意味着已入微信群。 |
| 活动报名、问卷管理、私人名单、统计与 CSV | `/api/activities/[kind]/[id]/signup` 的 GET/POST/PUT/PATCH；`/api/activities/manage` | 保留 `kind/id`、`mode`、`version`、`revision`、`answers`、`form`；`x-questionnaire-images` 与版本头；读取、编辑、提交、修改答卷和导出是不同权限。 |
| 问卷制作与填写 | 现有 `SignupForm`、16 题型及分组、显示/跳转/结束规则；导入导出、撤销重做、草稿续填、确认与回执 | 使用现有 normalize/sanitize/flow 计算，不在 UI 中再实现一套不同规则。被跳过答案不提交。新版本冲突不能静默覆盖。 |
| AI 问卷制作 | `/api/questionnaires/generate` GET/POST，JSON 或 `application/x-ndjson` | 保留生成/检查/修复进度、取消及连接中断反馈。只有完整且通过校验的 `result` 才替换草稿；现有草稿与需求不得因失败丢失。服务端密钥不进前端。 |
| 骨干招新批次、申请、撤回、评审与导出 | `/api/staff/batches/[id]/application` GET/POST/PATCH；`staff/manage/actions.ts` | 保留批次表单版本、申请 revision、评审独立字段、退回后重提和撤下批次的只读回执。私人名单与导出权限独立。 |
| 代表队创建、审批、生命周期、招新与选拔 | `/api/team-core` GET/POST | 保留 `operation` 分派、`version/revision`、draft/submit、撤回/决定/撤任；招新时间按北京时间录入与回显，既有问卷结构不被简单表单清空。 |
| 队员简介、分期、公开授权 | `/api/team-profiles/[teamID]` GET/PUT | PUT 仅接受 `profile`、`revision`、`membershipVersion`；保留任职快照、本人确认、对外公开授权与并发冲突提示。 |
| 代表队荣誉投稿、审核、档案 | `/api/team-honors` GET/POST；`/api/team-honors/[id]` GET/POST/PATCH；`teams/honors/actions.ts`；档案及视频路由 | 保留有效队员资格、独立审核人、队伍筛选/投稿入口、原状态机与 revision。公开档案不含私人证据、作者/任职标识或审核内部字段。 |
| 图片、视频 | 现有 publication image 字段及存储；`showcase-videos` GET/HEAD、`team-honor-evidence` GET/HEAD | 保留上传限制、说明文字、顺序、替换/移除动作、Range/HEAD、私有视频鉴权。禁止用公开风采视频路由访问荣誉私有证据；原私有文件名路由仍返回404。 |
| CMS、小程序、存活/就绪 | Payload REST、`/api/miniapp/[...path]`、`/health/live`、`/health/ready` | 本次网页重置不得改 CMS 模型或共享原生接口。就绪探测失败应保留503，不能仅为页面显示改成健康。 |

## 提交结果不确定与并发

- 保留现有 `activityRequest` 和 Server Action 结果处理逻辑。网络中断或服务端错误后的写入结果可能不确定，先让用户刷新本人回执/已保存记录核对，不能直接自动重复提交。
- 保留 `version`、`revision`、`membershipVersion` 与图片 revision 的服务端比较。409 等冲突要明确呈现并保留本地填写内容。
- 表单按钮的 pending、失败后重试、取消、返回、重复点击与浏览器 Back/Forward 均需前端最终回归；焦点应回到可操作元素或错误处。
- 服务端字段与返回形状保持原义；重绘可以改变布局和文案呈现，不得将旧失败转为成功提示。

## 本轮验证记录

后端审查的检查记录写入 [`docs/evidence/web-reset-backend-20261110.json`](evidence/web-reset-backend-20261110.json)。状态分为通过、失败和未运行；安装依赖或入口检查通过不代表数据库、浏览器或整站验收通过。

基线已通过：17 个纯逻辑/模拟接口测试文件的 208 项测试，以及新入口合同测试的 64 项检查。后端业务实现和迁移在这一步均未修改。最终前端改动后的相关复测、隔离 PostgreSQL 和浏览器结果应另行记录，不能沿用历史验收作为本轮完成依据。

隔离 PostgreSQL 的全部现有 Vitest 基线实际执行 1,694 项：1,580 通过、48 失败、66 跳过；92 个文件中 78 通过、14 失败。四个 HTTP 文件要求独立 QA profile，拒绝在 contracts profile 开始；其余失败包括已移除进群流程的旧期待、环境禁止 `tsx` CLI 的 Unix IPC，以及一个 VM 测试漏掉新增配图模块的依赖。失败结果完整保留，不记为全量通过。

本轮仅对该 VM 测试补入现有 `publicationImageLimit` 常量，不改原五项业务断言。修正后的五项测试与 64 项入口检查合跑共 69 项通过，改动测试的 ESLint 与 `git diff --check` 通过。未为通过旧用例而恢复已移除功能或放宽权限。

Claude 完成全部前端续做后的实际复验见 [`WEB_RESET_FINAL_VALIDATION_20261111.md`](WEB_RESET_FINAL_VALIDATION_20261111.md)：类型、282 项定向合同/逻辑、改动文件 lint 和生产构建通过；全量为 1,585 通过、43 个既有失败、66 跳过，失败签名未新增。原 131 份后端合同文件保持不变。全量测试及全仓 lint 仍未全绿，浏览器和视觉验收单独记录。
