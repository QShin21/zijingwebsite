# 代表队荣誉 · 实现与集成说明

分支 `codex/team-honors-20261012`；起点 `beac037eafe88b9b82e171e15cfddcca351b838b`。本模块只实现荣誉投稿、审核、实时队伍档案和社群风采置顶。

## 成员权威与权限

默认服务已接入核心 `getActiveTeamMembership(payload, {teamID,userID,req})`，唯一成员事实来自 `team-memberships`。`users.teams`、微信群进群记录和 `seasons.members` 昵称阵容不授予投稿资格。核心状态只有 active/revoked；离队使用 revoked 与 leftAt。重录取复用会员关系 ID，不用 joinedAt 推断真实历史获奖资格。

每次写入在同一 serializable 事务重读当前账号、成员、批准的建队关联及队伍/游戏状态。作者只写本人的当前有效队伍。批准前再次核验作者资格；离队后的待审记录不能新批准，原有批准历史及作者保留。新写入默认待审，兼任管理员的队员及社长/副社长也不能批准自己的记录。

审核使用当前 active 社群任职的 reviewShowcase 能力，社长/副社长保留已有高权限。骨干和旧 communityAdmin 标签没有全局荣誉材料能力；骨干作为有效队员可投稿自己的记录。私有材料仅作者、该社群当前审核者或已有高权限管理者读取，字段/列表查询不会扩大集合的作用域。

事务共享锁保护账号、队伍、游戏、批准建队关联及真实 membership 行；批准/改稿/撤回对同一荣誉加行锁并比较数值 revision。成员退出、队伍停用和撤任更新必须等待或触发冲突；重复批准、过期页面及并发改稿不能覆盖新状态。

## 状态、证据及历史入口

支持草稿、提交、撤回、退回说明、修改重提、拒绝、批准、隐藏。批准或待审后的内容修改可直接重提；未改内容的重复提交被拒绝。修改立即撤下当前投影，重新由他人批准后展示；每次批准的私有证据快照保留在历史中。隐藏不删除作者、原内容或历史。

证据图片复用静态图片验证、去元数据与 WebP 归一化；视频复用受控本站 MP4 和 SHA-256 字节版本。提交、批准、公开投影及实际视频读取核对版本；替换或删除使展示失效。新荣誉不接受可变外链证明，不抓取任意 URL。上传失败只在确认新文件没有被提交引用后清理，提交结果不确定时保留文件。

旧 `honors` 保留已核验/发布记录、作者及赛季，以明确的历史来源加入同一档案。旧时间按原 CMS Asia/Shanghai 的日历日期展示，数据库值不改；旧荣誉有明确 game 且与当前队伍社群冲突时不静默移动。旧无建队链的队伍历史可以兼容展示，不能由此获得新投稿资格。

旧 CMS/REST 的 honors 新增、重新发布、内容修改和删除已关闭，防止高权限成员从旧入口自审或绕过新证据规则。历史导入仅允许明确的受信 Local API system 上下文与 overrideAccess；HTTP JSON 不能设置该上下文。当前对应社群审核者或已有高权限管理者可撤下旧荣誉。旧内容修订通过新的成员投稿流程重新审核。合成历史 fixture 用受控 system 初始化，未生产导入。

## 稳定网页与 HTTP 合同

- `TeamHonorsPanel` 可直接嵌入父任务统一代表队/荣誉页面，接收 payload、user、view、page 和可选 team/game；私人列表和投稿队伍同步按给定范围过滤。
- `/teams/honors`：档案、本人记录、对应社群审核及投稿；`/teams/honors/[id]`：私人记录、审核和改稿。
- `/community/[slug]/showcase/team-honors/[team]`：同一队伍的稳定档案详情。错误社群或空档案不渲染材料；Next 流式页面可能返回 200 的未找到界面，不能用 HTTP 状态代替内容权限测试。
- `GET /api/team-honor-archives/[team]`：匿名、overrideAccess:false 的最小批准档案 DTO；空/停用/隐藏档案 404。没有 membership/author 账户 ID、审核说明、旧批准快照或审计历史。
- `GET/HEAD /api/team-honor-evidence/[id]/video?version=<批准版本>`：仅当前可见批准证据；`?revision=<当前修订>`：仅作者或当前对应审核者。支持 Range，打开一次并以同一字节缓冲验证/返回；失效证据不提供新字节。全部 no-store。
- 原始 `team-honor-records` POST/PATCH/DELETE 不可替代网站动作；伪造 JSON context 或审核字段不能取得服务器请求授权。

### 小程序受保护 HTTP 写入

`GET /api/team-honors?view=mine|review&page=1&team=<可选>&game=<可选>` 返回按当前权限过滤的 `docs/totalDocs/page/totalPages` 和本人当前有效投稿 `teams`。`GET /api/team-honors/[id]` 返回 `{ record }`。私人 DTO 包含 `id/revision/state/team/game/season/title/authorName/competition/placing/date/description/images/videoHref/submittedVersion/reviewNote/canReview`，不包含账户作者 ID、membershipRef、历史快照、审计或原始媒体存储地址。

`POST /api/team-honors` 新建，只支持 `save/submit`；`POST` 或 `PATCH /api/team-honors/[id]` 更新或审核。JSON 根字段仅允许 `action/revision/submittedVersion/note/input`。保存/提交的 `input` 仅允许 `team/season/title/competition/placing/date/description/images/removeVideo`；`images` 每项为 `{ source: 静态图片 data URL, caption: 说明 }`。不接收 `author/game/state/context/overrideAccess/videoURL`；队伍/游戏、作者、赛季历史归属由服务端绑定。更新必须带当前 `revision`；批准同时带当前 `submittedVersion`。`return/reject/hide` 必须给 `note`；`approve/return/reject/withdraw/hide` 不得附改稿 `input`。返回新建 201、更新 200 与最新 `{ record }`；遇到 409 刷新核对。

视频通过同一地址的 `multipart/form-data` `save/submit` 上传：文本字段同网页，`pictures` 可重复、`newCaption-0..5` 为新图片说明、`caption-0..5/removeImage-0..5` 管理已有图片，`video` 为 MP4 文件，`removeVideo=on` 移除已有视频。图片每份 2 MB、最多 6 份；视频 10 MB；本次上传合计 12 MB。JSON 正文最多 17 MB、multipart 正文最多 14 MB，流式计数并拒绝超限。媒体检查复用已验收静态图片规范化与 MP4 文件头/字节版本，不抓取任意 URL。

原生请求用有效 `Authorization: JWT <登录 token>`；无 Origin 时仍须显式 JWT。JWT 认证时去掉环境 cookie，失效 token 不能回退 cookie。浏览器 cookie 写入要求 Origin 与配置 `SERVER_URL` 的 origin 严格一致，跨源和 `null` Origin 拒绝。动作进入同一串行化事务服务，实时复核账号、核心成员关系、社群任职、自审、版本与证据。跨社群、普通骨干及失效任职无法读取他人材料。错误按实际状态返回 400/401/403/404/409/413/415/503，响应全部 no-store。

### 视频归属与公开 DTO 收紧

公开档案及公开记录已移除 `videoURL`，只返回 `videoHref=/api/team-honor-evidence/[id]/video?version=<批准版本>`；私有工作台使用 `?revision=<当前修订>`。小程序应使用此地址，不拼接存储标识或把证据地址提交到普通风采。作者及当前对应审核者仍可通过私人修订端点查看自己的未公开材料；匿名与跨范围请求只按有效公开版本授权。

新荣誉 MP4 存入 `MEDIA_DIR/.team-honor-videos`；数据库 `/api/private-team-honor-videos/<UUID>.mp4` 是内部标识，直接 GET/HEAD 一律 404。普通风采不能接受这个私有标识。对隔离改造前已存的 `/api/showcase-videos/<UUID>.mp4` 荣誉证据，通用视频端点和风采写入同时检查当前/历史荣誉引用，并建立 `MEDIA_DIR/.showcase-videos/.team-honor-reserved` 永久隔离标记。改稿前先写标记，替换、隐藏、历史引用移除后仍拒绝通用端点；已有本人或旁人待审风采复制不能成为授权依据。旧批准证据继续由荣誉版本端点校验后提供，普通独立上传及已发布风采的视频流程保持。

上述媒体改动无需新增数据库迁移。备份/回滚必须连同两处私有目录与永久标记保留，并保留通用端点的隔离检查，避免回滚到旧视频旁路代码。

每个队伍只有一个实时档案，不创建 community-showcase 复制记录。仅批准、仍可见且证据有效的记录参与聚合；新批准更新同一链接。第一风采页挂置顶，普通风采仍独立按原集合分页。记录隐藏、空档案及队伍 archived/archived=true 撤下置顶；游戏未发布/归档同样撤下。resting 的新写入资格沿用核心实际判定。

## 借入依赖与共享集成点

经父任务授权，已按序 cherry-pick 真实核心依赖，勿在最终集成时重复套用：

- `5866adcd8a638273f23f2f66e3992e48f2a46873` → 本分支 `1e97646`（合同）。
- `e74e6a4fa7281bcd2edcf667343b9e653380f40d` → `8e3b8f5`（真实读取 API、四集合、生命周期及最小注册；冲突保留双方集合后重新生成类型）。
- `567e359907418a2ebdb14833cfc5838901a09892` → `4b1a220`（类型修正）。
- 仅从 `aec6f2675fbbe6074ad3867cff21e6fc69c6adaa` 借入精确 `src/migrations/20261012_160000_team_core.ts`，加一条索引。没有借入核心业务服务/UI或整个快照/迁移索引。
- 最终必要读取依赖更新到已复核 `bf6665c57d83ffa269845c76ff6903d23e0510de`：仅借入精确 `src/collections/team-core.ts` 与 `src/lib/team-memberships.ts`，包括统一双归档标记、阻断低权限旧标记恢复及当前集合读取修订。未重复 160000 迁移，未借入核心服务/网页/招新 HTTP 文件。父任务集成完整核心时两文件应保持该版本或后续已复核版本，不回退旧钩子。

荣誉专属文件与唯一迁移由本模块维护。共享补丁只有集合注册、旧 honors 的保护包装、迁移索引、生成类型、风采列表挂接、历史 CMS fixture 的受控初始化，以及按父任务安全审查授权增加的普通风采视频端点/集合隔离检查（各 5 行）。不要整文件覆盖其他模块。核心迁移索引须只有一个同名项，最终联合 JSON 快照需要合并四个核心集合、简介及本模块，而非按最后文件覆盖。

父任务仍需统一顶级导航、/teams 与旧 /honors 入口，并完成申请/招新/录取整体闭环与三模块联调。本分支真实读取接口测试使用合成批准链，不等价于建队审批到招新录取 UI 闭环。

## 迁移与回滚

`20261012_080000_team_honor_records.ts/.json` 只添加记录表、索引及锁关系，不复制/改写旧 honors。membershipRef 是经核心验证的原始成员关系 ID，数值历史引用让荣誉迁移可独立执行；无第二成员表。team/game/author/season 外键采用 RESTRICT 保护归属，后续自动生成迁移不能把这些约束改回 SET NULL。

干净合成库已从全部基线顺序执行荣誉和精确核心迁移；单独增量演练对比旧 honor 全行，作者/赛季和值不变，只增加一张荣誉表。生产未迁移。应用回滚保留表、证据与批准历史，down 明确拒绝丢数据删除。回退到不含独立社群能力的旧版本仍须通过项目既有权限回滚门禁。

## 验证与交付切片

已推送的本模块切片：`80c9f6961a7fb375bdc4215fe4fca8bdbd30d2e9`（模型/合同）；`2a94cd352d1856dd86db4735b60185c0804134fd`（审核/聚合/证据与迁移）；`397d6092e11c5b29a91916a5fead339c1a5602c4`（网页/稳定详情与 API）；`d81770b0212ef9b285a6b1858e2300deb9037b78`（真实成员权威接入及旧荣誉入口封闭）。HTTP 写入及媒体隔离追加切片在本分支后续提交中。

封闭历史旁路前，274 项全量测试、3 项浏览器流程、类型、lint 与构建通过。真实核心接口 4 项测试涵盖批准建队链、当前账号/成员、撤销/离队、停用及 SQL 行锁并发。历史入口封闭后相关 27 项测试和类型检查通过，最后全量/浏览器/构建复测结果以 [执行证据](evidence/team-honors-20261012.json) 为准。所有状态操作限定新的合成隔离数据库，不触达真人、审核真人或发送真实通知，不 PR、不合并、不部署。

`d81770b` 的精确 CI `38222943389` 曾出现 275/275 单测、63 项 E2E 通过和 1 项失败，构建跳过。已读取其 artifact `11736495578`：两次 textarea 替换后的 DOM 值在提交前拼接了旧说明，最终批准投影如实显示拼接内容。编辑表单现于客户端事件就绪后开放，事件值立即快照；三个说明编辑点都在提交前断言精确值，并保留公开档案 exact 断言。没有增加超时或放宽匹配。后续源码的 CI 独立核验，不沿用旧提交绿灯。

媒体 HTTP 初轮定向运行通过；受影响三套 E2E 合跑时，另一次 409 是同时启动同数据库模块测试造成的串行化冲突（trace：08:47:05 的 save；模块测试始于 08:46:59）。已恢复状态测试顺序运行，其他账号只预登录一次，不在荣誉事务期间制造无关登录写入；权限和版本冲突断言保持。顺序重跑 10 项 E2E 通过。更新到最终核心读取依赖后，282 项/35 文件全量测试、类型/Lint 和现有小程序静态检查通过；最终网页/构建及新精确 CI 结果见执行证据。

最终核心依赖切片为 `a37390db3c38eb360c7f5c706193a89e8a7e53cf`；其后源码下 4 项荣誉 E2E（含真实 HTTP/MP4 播放及精确改稿）和构建通过。剩余顶级导航、完整核心/简介 UI 与联合快照由父任务集成；本模块不把合成建队链视作完整申请/招新 UI 验收。新交付提交的 CI 终态随交付回复单独给出。
