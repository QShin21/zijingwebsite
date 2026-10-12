# 小程序荣誉读写合同 · 2026-10-12

网页服务依赖父任务批准的 `196ebf841c77f7a725ed6b41100cd66b341faea5`，真实成员权威来自核心 `bf6665c57d83ffa269845c76ff6903d23e0510de`。本分支仅增加 GET 动作提示及原生消费者；原荣誉写入、状态流转、锁、修订、提交版本和视频授权继续由既有服务执行。源合同见 [荣誉模块](../TEAM_HONORS.md)。

## 读取与动作提示

- `GET /api/team-honors?view=mine|review&page=1&team=<可选>&game=<可选>`：使用原 workspace ACL 和每页八条分页，保留 `docs/totalDocs/page/totalPages/teams`；新增 `actions.create/review`。`teams` 是当前本人有效成员关系的最小可投稿队伍，受同一 team/game 筛选。
- `GET /api/team-honors/:id`：保留原最小 `record` 投影。列表中的每条记录及详情 GET 新增 `record.actions = {edit,save,submit,withdraw,hide,reviewActions}`；`reviewActions` 只包含当前允许的 `approve/return/reject`。
- 读兼容位于 `src/lib/miniapp-team-honor.ts`，刷新当前身份并缓存本次读取中的权威查验，复用 `nextHonorState`、真实成员权威及批准所需的证据完整性 / 版本核对。普通社群管理员、历史阵容或账号中旧 teams 字段不构成私有投稿权限。
- GET 提示会随身份、成员关系、归档、内容和版本变化而过期。客户端不推导角色或业务状态；每次写入仍由原服务在事务中重新核验。POST/PATCH 的响应没有新增动作，确认写入后关闭旧按钮，成功 GET 后恢复。

## 原生写入

JSON 写入继续使用 `POST /api/team-honors` 或既有编号的 `POST /api/team-honors/:id`。保留原 `action/revision/submittedVersion/note/input` 白名单；已有记录携带数值 revision，批准同时携带本次提交版本，退回 / 拒绝 / 隐藏需说明。客户端不发送作者、资格、审核状态、原视频 URL 或内部媒体标识。

投稿页处理完整文字、日期、最多六张图片及说明，原所属队伍 / 赛季保持服务端绑定。图片 JSON 通过现有服务统一处理。保存草稿、提交、反馈、退回修改、撤回、隐藏及审核直接调用原动作，失败保留输入，修订变化后须显式重新读取。

微信当前官方上传声明只提供单文件 `filePath/name`。本项目将 MP4 上传设计为两次明确的用户操作：先保存 JSON 草稿取得编号及修订，再选择视频并执行一次 multipart `save`；之后由用户另行提交审核。视频上传携带完整原文字及保留图片说明，不自动串联两条 POST，不调用普通风采或原集合上传。新增 / 重排图片须先明确保存图片资料。此方式是客户端设计，官方工具及真机行为仍未验证。

新建接口没有幂等键。首次新建遇网络或 5xx，原生保留草稿并锁定重复创建，提示主动检查本人记录；不会自动重试，也不会按同名记录认领成功结果。

## 媒体与异步边界

私有视频仅接受服务 DTO 中匹配记录 ID 和数值 revision 的本站受控 `videoHref`；使用当前 JWT 下载至客户端自有 MP4 文件，核对 HTTP 状态，再交给原生 video。公开档案只使用服务端批准版本的受控地址。原 storage / showcase / `videoURL` 不作为回退入口。客户端核对实际大小不超过 10 MiB 和短 ftyp 头，完整容器校验继续由服务端执行；新增、重排或相同 source 的歧义图片均在上传网络前拒绝。

每次私有下载请求按当前 JWT 授权。已经合法下载的字节不会因后续权限变化被平台远程收回；原生在 hide、账号变化和失效下载时主动清理自有临时文件。

选图 / 选视频由用户主动操作触发隐私授权。确认框、选文件和写入锁跨 hide/show 保持至 finally。账号 / 页面上下文变化使迟到结果失效；原上下文的后台真实成功仍保留确认，恢复时只 GET 对账。写入成功而 GET 失败时显示已保存回执并关闭旧动作；处理说明和未保存输入继续保留。临时媒体在离开、切换身份及失效下载后清理。

当前官方 API 可核验来源：[微信官方 api-typings 6092df9 的上传 / 下载声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts)。官方开发文档站正文访问受阻；合法域名、隐私声明、JWT 请求头、视频播放及临时文件清理仍需平台与 iOS / Android 检查，不代表审核通过。

## 验证归属

合成 SDK 测试使用真实 Page / helper 与 Node VM 回调；路由测试使用真实 JWT / ACL / 状态服务和独立合成 PostgreSQL，媒体为合成 WebP / MP4。网页 Chromium E2E 与微信官方组件、模拟器、真机是不同证据。本轮实际62项真实Page/合成SDK、111项媒体SDK、15项真实路由/SQL全部通过，已纳入全量1030项联合回归。明确的401/403/404/409拒绝后清旧动作、停止旧播放器并删除自有视频文件；当前本人文字草稿及处理说明继续保留，成功GET才恢复允许的动作。精确执行次数与最终提交见 [适配记录](../MINIAPP_TEAM_FLOWS.md) 及 [证据](../evidence/miniapp-team-flows-20261012.json)。
