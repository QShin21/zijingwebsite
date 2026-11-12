# V2 后端任务说明（交 Sol，2026-11-12）

前端（Claude Opus 5.5）在 V2 实施中发现、需由后端所有者处理的事项。前端未修改 `src/lib/**`、`src/app/(frontend)/api/**`、`actions.ts`、collections、access、proxy、globals、migrations 或 payload 配置；下列每项给出现状、建议与验收方式，均未运行验证。

## S1 日程「可报名」筛选（A3 `getCalendar`）
- 现状：`getCalendar` 无 `signupOpen` 参数；网页 `/events` 与小程序日程因此不提供「可报名」视图（客户端过滤会破坏分页与 `totalDocs`）。
- 建议：增加 `signupOpen?: boolean`，在服务端按 `signup.state === "open"` 过滤后再分页；`/api/v2/calendar?signupOpen=1` 同步支持。
- 验收：返回项全部 `signup.state === "open"`；`totalDocs/totalPages` 与过滤后一致；访客与成员按现有可见范围不变。前端随后在 `/events` 范围标签与小程序日程加入「可报名」。

## S2 社群头信息减负（`getCommunity`）
- 现状：社群布局每次请求读取 50 条社群活动再截取 3 条，布局另用 `bySlug("games")` 取标题。
- 建议：提供轻量 `getCommunityHeader({ slug })`（社群引用、色相、简介、viewer 能力、计数），活动列表按需单独读取。
- 验收：社群各分区页（updates / showcase / contacts）首屏只触发一次轻量头查询；权限字段与 `getCommunity` 一致。

## S3 小程序受控图片
- 现状：`<image>` 不能附带 Authorization，`lib/v2-images.js` 对受控图片逐张以 JWT 下载为临时文件（并发 4、账号变化清缓存）。多图列表请求数偏多。
- 建议（需安全评审）：短时、绑定用户与对象的签名 URL，或批量缩略图接口。不得放宽媒体权限或让匿名可读。
- 验收：签名过期、撤权后失效；`tests/miniapp-content-flows.test.ts` V2 图片用例改为签名路径后仍断言受控图不走公开直连。

## S4 网页专属队列的原生标记
- 现状：`ApplicationItem.href`、`ManageQueue.href` 只有网页路径；小程序对 `/community/promotions`、`/activities`、`/admin` 硬编码「请在网页端完成」。
- 建议：合同增加 `webOnly: boolean`（或 `nativeRoute`），由服务端声明哪些队列可在小程序处理。
- 验收：小程序管理台不再维护路径白名单；网页行为不变。

## S5 队伍 slug 与静态段冲突
- 现状：新增网页路由 `/teams/[slug]`；与静态段 `apply`、`honors`、`manage`、`profiles`、`recruitment` 同名的队伍 slug 会被静态页优先匹配，队伍页不可达。
- 建议：`teams` 集合 slug 校验保留这些词；只读检查现有数据是否已有冲突（需要时由用户授权迁移）。
- 验收：创建/改名为保留词被拒绝，提示中文原因。

## S6 主场升推投影
- 现状：旧主场有 `promoted-event / promoted-notice / promoted-showcase` 模块。V2 `getHome` 由 `spotlight`（featuredEvents）、`upcoming`（日程前 6 条）、`notices`（公告 feed）、`highlights`（`promotedOnly` 动态）组成。前端已在卡片上输出 `data-promotion-source="community-posts:{id}" | "community-showcase:{id}"`，`tests/e2e/content-promotions.spec.ts` 改为检查 `main [data-promotion-source=…]` 出现与消失。
- 需确认：已升推的社群活动、社群通知是否必然进入 `upcoming` / `notices`（例如活动无开始时间、或被前 6 条挤出时会缺席）。若不能保证，建议在 `HomeResponse` 增加 `promoted: { events, notices, showcases }` 投影，前端增设「社团精选」区。
- 验收：升推通过后主场可见、改稿待复审或隐藏后消失；访客不可见社群专属内容。

## S7 首页模块配置（`site.modules`）
- 现状：`src/globals/Site.ts` 已注明「V2 网站不使用此字段」，V2 主场为固定版式；`tests/e2e/site.spec.ts` 改为断言该字段不再影响页面（CMS 主标题、焦点活动仍生效）。
- 需确认：AGENTS.md / `docs/UI_REDESIGN.md` 要求保留「CMS 配置能力」。若运营仍需隐藏或排序主场区块，请设计 V2 字段（例如可隐藏「赛场高光」「游戏社群」），前端按新字段实现。

## S8 账号页历史深链
- 前端已把旧通知链接 `/account?view=history#applications-title` 映射到「我的申请」视图并保留同名锚点；`getMyApplications` 无需改动。仅告知，无需后端处理。
