# 网站与小程序中英文切换（2026-11-13 起，2026-11-14 更新）

本文记录双语实现的设计、迁移、回退、测试证据与未完成范围。实际实现模型 Opus 5.5 medium；未提交推送、未部署、未上传微信、未调用真实 AI、未读取任何密钥或 `.env`。

## 1. 设计

### 1.1 界面语言（静态文字）

- 默认中文；英文为可选显示层。网页使用一年期第一方 cookie `zijing_locale`（`zh`/`en`），顶栏「EN / 中」按钮切换后 `router.refresh()` 原地重渲染，表单客户端状态保留；`<html lang>` 随之变化。
- 小程序使用本地存储 `zijing_locale`，每个请求附带 `x-zijing-locale` 头；「我的」页提供切换（见第 4 节覆盖清单）。
- 静态文案就地写成中英文对：服务端组件 `const { t } = await getT()`，客户端组件 `useT()`，`t("中文", "English")`。英文缺失时回退中文，界面不会出现原始键名。
- 服务器接口的中文报错与状态文字保持原合同（其他客户端与测试依赖）；显示时由 `localizeMessage()`（`src/lib/i18n/messages.ts` 及各区域标签表）转换，未知消息显示中文原文。
- 日期统一北京时间：`src/components/v2/format.ts` 的格式化函数增加可选 `locale` 参数，中文输出与原来逐字一致。
- 静态界面不经 AI 翻译，也不做全局 DOM/JSON 文本替换。

### 1.2 已发布内容（活动、通知、问卷）

| 环节 | 实现 |
| --- | --- |
| 范围 | 社团活动 `events`、公告 `announcements`、社群活动与通知 `community-posts`（category event/notice）。字段：标题、摘要、地点、正文（Lexical 文本节点 / 社群纯文本与文章文本块）、社团活动的报名要求与报名渠道说明、问卷标题/说明/完成提示/题目/帮助/占位/选项/矩阵行/信息组字段与选项。 |
| 排除 | 联系方式、二维码、内部备注、草稿、报名答卷、个人资料、选座申请与私人票据/凭证图片、问卷配图、审核意见；新闻、影像、风采、荣誉、队伍与固定页正文仍为中文（见第 5 节）。 |
| 触发 | 集合 `afterChange` 钩子在**同一数据库事务**内（savepoint 隔离）写入队列标记，`generation + 1`；事务回滚则标记一同撤销。仅当文档当前或之前处于已发布/可见状态时写标记（从未发布的草稿不产生任务）。删除文档同事务删除行。钩子不调用 AI，也不保存原文快照。 |
| 执行 | 工作进程以 `FOR UPDATE SKIP LOCKED` 领取一行，写入随机 `lease_token`，租约 180 秒；**每次领取最多一次 AI 调用**（单次 60 秒超时，最多 40 段 / 4000 字）。调用前用 `overrideAccess:true, draft:false` 重新读取**已提交的已发布版本**；已撤稿、隐藏或删除则置 `obsolete` 并清空英文，不调用 AI。 |
| CAS | 回写条件 `lease_token` 匹配；租约过期被他人接手后，旧进程结果被丢弃。领取期间若有新发布（generation 变化），回写后行回到 `pending`，下一次领取读取最新内容。并发入队只增加 generation，不重置正在进行的租约。 |
| 缓存 | 英文按「中文原文 SHA-256」存储；显示时只替换与当前原文完全相同的文字，内容修改后旧英文不会显示，未变化的段落复用不再计费。 |
| 限额 | 每次 AI 调用占用全站每小时 120 次额度（复用 `auth_rate_limits`）；超额时任务延后 15 分钟且不计失败。每个 generation 最多 3 次失败重试（指数退避），之后 `failed`，显示中文。 |
| 恢复 | 队列行持久存在。服务器启动时 `src/instrumentation.ts` 的 `register()` 启动进程内巡检（启动 15 秒后首轮，之后每分钟一次；每轮最多 10 次领取、每次至多一次 AI 调用，受小时额度限制；空队列只有一条带索引的 UPDATE），因此重启后即使无人发布或阅读英文，待处理任务也会继续。发布钩子与英文读者到来时只会提前触发同一工作。进程在最后一次重试中崩溃时，过期租约在下一轮被置为 `failed`（`lease_expired`），不会永久停在处理中；重新发布开始新的一代。读取已发布版本时的数据库临时故障按错误重试（`read`，退避，最多 3 次后 `failed`），保留已有英文，不会误判为撤稿；只有文档不存在或未发布才作废。访客只会推进已有任务，不能创建新任务。 |
| 无密钥 | 未配置 `QUESTIONNAIRE_AI_API_KEY` 时不写队列、不调用，英文模式显示中文；配置无效（非白名单端点）同样关闭。 |
| 安全 | 复用问卷 AI 的 `questionnaireAIService()`：仅允许 `https://llmapi.paratera.com/v1`，`redirect: "error"`，密钥只在服务端请求头中使用，不写数据库、日志或响应；错误只记录短代码。模型输出逐段校验：仅接受已知 id 的字符串，去控制字符与双向控制符，长度上限，仍含大量中文视为未翻译；HTML 以纯文本保存，由 React 转义显示。 |

### 1.3 权限与问卷值稳定

- 英文覆盖在**原有访问控制读取完成之后**进行（`localizeView`、`localizedFormDisplay`）：只替换结果中已有的字符串，不新增文档、字段或受众；三档 audience、`overrideAccess:false` 公共读取与问卷隐私保持原样。没有独立的翻译查询接口。
- 问卷 `form` 原样返回；英文放在旁边的 `display` 字段（仅填写视图、英文请求时）。选项、矩阵行、信息组字段选项的英文是 `[原值, 英文]` 对，**按原值查找**，因此随机排序、过滤或重排后标签仍对应提交的原值。答卷、分支（display/jumps/showWhen）、互斥选项、校验、统计与导出继续使用中文原值；英文与中文提交结果相同。
- 回执中只有与当前发布题目同 id、同题干、同题型的历史题目才显示英文，其余显示提交时的原文。管理端统计与导出保持中文原值。

### 1.4 运行方式（仅源码，未部署）

- 默认：Web 服务进程内巡检（上面的启动钩子），无需额外进程或配置；与现有 `next start` 一同运行。
- 可选独立 worker：Web 设 `CONTENT_TRANSLATION_WORKER=off`，另起 `node --import tsx scripts/translation-worker.ts`（常驻，每分钟一轮）或用定时器运行 `--once`。使用同一数据库与问卷 AI 密钥环境变量，不需要新密钥或新权限；多个 worker 可并存（行锁 + 租约令牌）。输出仅计数。
- 历史内容：`node --import tsx scripts/translation-backfill.ts --confirm --limit N [--process M]`（默认只入队）。
- 关闭翻译：移除 `QUESTIONNAIRE_AI_API_KEY` 或设 `CONTENT_TRANSLATION_WORKER=off` 且不运行独立 worker；英文模式显示中文。

## 2. 数据库迁移与回退

- 新增 `src/migrations/20261113_000900_content_translations.ts`（编号排在 main 的 `000700_custom_seat_layout` 与 `000800_personal_archives` 之后，三者均保留）：只新建 `content_translations` 表与索引，不修改任何既有表或数据，`IF NOT EXISTS` 可重复执行。
- 表缺失（迁移未执行）时：发布正常（savepoint 吸收错误），英文模式显示中文。就绪检查 `/health/ready` 不依赖此表，翻译故障不影响服务可用性。
- 回退：应用回退后该表可保留（无人读取）；`down` 仅删除此派生表，可再生。未在生产执行任何迁移。

## 3. 测试证据（本地，2026-11-14）

| 检查 | 结果 |
| --- | --- |
| `tests/content-translation.test.ts`（语言解析与持久化读取、消息翻译、段落提取不含私人字段、版本失效、富文本仅替换文本节点、发布状态判定、问卷 display 与原值、随机排序映射、部分翻译回退、模型输出校验、无密钥/非白名单端点不发请求、密钥不出现在错误中、提示注入文本按数据处理） | 18/18 通过 |
| `tests/questionnaire-english-render.test.ts`（真实 `Questionnaire` 组件 SSR：随机排序后每个英文标签对应其原值；中英文界面文字） | 2/2 通过 |
| `node scripts/verify-bilingual-database.mjs`：嵌入式 PostgreSQL 合成库；升级检查（先删除本迁移模拟旧库并写入旧活动，再迁移：既有数据与迁移记录不变、不产生任务、就绪检查 200）+ `tests/content-translation.integration.test.ts` 20 项 | 升级 PASS；集成 20/20 通过 |

集成测试覆盖：发布入队且请求内不调用 AI、只发送已发布公开文本（不含联系人、手机号、答卷）、V2 英文读取与日历、问卷 display 与中文原值提交、修改后失效且只重发变化部分、草稿不翻译、**事务回滚不留任务**、**撤稿与隐藏在调用前取消并清空英文**、删除同步删除、**处理中发布与并发入队不重置租约且回到 pending 后翻译新内容**、**租约过期的旧进程不能覆盖新结果**、跨进程并发不重复调用、校内活动对匿名英文读者仍不可见、提供方失败回退中文且最多 3 次、恶意输出、小时额度、无密钥、回填、缺表回退。

验证中发现并修复：工作函数在无需等待时同步返回会留下永不清除的共享 Promise，导致该进程此后不再处理队列（`processTranslationQueue` 现先让出一次再执行）。

## 4. 覆盖清单

统计工具：`node scripts/i18n-coverage.mjs [路径]`（TypeScript AST 扫描，列出不在 `t()`/`Tr`/`localizeMessage`、语言三元式或中英属性中的中文字面量；`// i18n-exempt` 标注为必须保留的中文）。小程序以 WXML 中残留中文与 `tests/miniapp-i18n.test.ts` 的字典键扫描核对。

### 4.1 网站 44 个页面（`src/app/(frontend)/**/page.tsx`）

全部 44 个页面及其使用的组件扫描结果为 0（另有布局、loading、error、not-found、元数据 `generateMetadata`）：

- 公共与阅读：首页 `/`、`/events`、`/events/[slug]`、`/announcements`、`/announcements/[slug]`、`/gallery`、`/gallery/[slug]`、`[...path]`（关于/联系/隐私/加入/新闻等固定页与旧链接）、`/preview/[collection]/[id]`。
- 账号与加入：`/login`、`/register`、`/account`、`/account/reset`、`/join/staff`、`/join/staff/batches/[id]`。
- 社群：`/community`、`/community/apply`、`/community/review`、`/community/promotions`、`/community/[slug]`、`appearance`、`showcase`、`showcase/[id]`、`showcase/new`、`showcase/team-honors/[team]`、`updates`、`updates/[id]`、`updates/new`。
- 代表队与骨干：`/teams`、`/teams/[slug]`、`/teams/apply`、`/teams/honors`、`/teams/honors/[id]`、`/teams/manage`、`/teams/manage/[id]`、`/teams/profiles/[teamID]`、`/teams/recruitment`、`/teams/recruitment/[id]`、`/staff/manage`。
- 活动与问卷：`/activities`（问卷工作台）、`/activities/[kind]/[id]/fill`、`manage`、`signups`、`seating`（含自定义座位布局编辑、私人票据管理界面文字）。

剩余 192 处均在：`src/components/visual-direction/**`（设计预览，未接入正式页面，未翻译）与 `src/app/(frontend)/api/**` 路由返回的中文消息（接口合同不变，客户端用 `localizeMessage` 及区域标签表在显示时翻译，未收录的少见消息显示中文）。

### 4.2 小程序 30 个页面

全部 30 页（含归档新增的 records）、自定义 tab bar、`privacy-consent`/`zj-stage`/`zj-campus` 组件与 6 个模板已接入 `lib/i18n.js`（页面字典 + `i18n.bind`，导航栏标题 `i18n.navTitle`）。WXML 残留中文只有首页装饰字「紫」与和服务器中文状态值的比较（如 `info.state === '报名开放'`），显示文字另有翻译字段。`tests/miniapp-i18n.test.ts` 扫描所有 WXML 的 `t.键` 在中英文字典中都存在。

页面：home、events、communities、teams、account（语言切换入口）、list、detail、fixed、auth、community、applications、review、signup、activity-manage、staff、staff-review、team、team-apply、team-review、team-members、team-honors、team-profiles、team-honor-workspace、team-honor-edit、team-home、recruitment、showcase-new、explore、activity-seating、records。

## 5. 未完成与已知限制

1. 未执行真实浏览器、微信开发者工具或真机验收；英文界面未做人工视觉检查（长英文可能在窄屏换行，未调整样式，以免与美工改动冲突）。
2. 小程序切换语言：当前页立即更新；后台页面（tab 页及页栈中的页面）立即更新静态文字，并在重新显示时刷新脚本生成的文字和内容（日程、加入我们、代表队按需重新读取一次；选座、骨干审核、代表队工作台、固定页重新标注）。报名问卷页在返回时就地重新标注，切换到英文时用同一版本读取一次英文标签，未提交的答案、步骤和核对状态保留，不重复提交；换账号时迟到的读取结果被丢弃。提交进行中切换语言时只重新标注，英文标签在下次显示时取得。
3. 只翻译活动、公告/社群通知与问卷；新闻、影像、风采、荣誉、队伍介绍、社群介绍、固定页（关于/隐私等）CMS 正文仍为中文。站点名称在英文模式使用固定英文名。
4. 服务器接口消息保持中文合同；常见消息已有英文，少见消息显示中文。服务器动作返回的部分团队/荣誉消息经各页面映射显示。
5. 问卷管理端（编辑器、统计、导出、抽签结果）保持题目与选项中文原值；只翻译界面外框。问卷模板插入的默认内容保持中文。
6. 未配置密钥期间发布的内容不会自动入队，启用后需运营者执行回填脚本；回填与生产迁移均未执行。
7. 发布后到英文出现有延迟（发布后约 1.5 秒触发，每次领取一批；巡检每分钟一次，服务器启动后 15 秒首轮）；延迟期间英文模式显示中文。worker 读取到发布版本与真正调用之间存在极短窗口，期间撤稿的文字仍可能已发送一次（只会显示给仍有权限且文字完全一致的读者）。
8. 个人记录归档（`a50d1a1`）已合并：网站“我的”页归档提示、归档按钮、全部报名/全部申请，以及小程序“我的”页与新增 `pages/records` 均已中英文化（小程序共 30 页）。
9. `src/components/visual-direction/**` 设计预览未翻译。

## 6. 最终运行记录（2026-11-14，本地 Linux，合并 `a50d1a1` 之后）

| 检查 | 结果 |
| --- | --- |
| 本地合并 | `c9e8d69`（合并 `0750cd2`）、`21bc868`（合并归档 `a50d1a1`）；均未推送 |
| `tsc --noEmit` | 通过 |
| 改动文件 ESLint（相对 `a50d1a1` 的 251 个 ts/tsx/js/mjs） | 仅 2 项基线既有错误（`custom-tab-bar/index.js` 的 `Component` 未定义、`signup/index.js` 空块；基线文件同样报错） |
| `node scripts/check-miniapp.mjs` | 通过：30 页、220 文件、1,548,567 字节 |
| 全量 Vitest 对比基线 `a50d1a1` | 本树 1922 项：1736 通过、172 失败；基线 1856 项：1670 通过、172 失败。按测试全名逐条比较无新增失败；唯一新增的非通过文件是只能在专用合成库运行的集成测试 |
| `node scripts/verify-bilingual-database.mjs` | 升级检查 PASS（旧活动与既有迁移记录保留，含 000700/000800/000900 共 40 条，就绪检查 200）；集成 24/24 通过（新增：崩溃后过期租约转 failed、未过期租约不提前失效、数据库读取故障重试且不作废、服务器启动钩子在无人访问时恢复处理） |
| 重点测试 | `content-translation` 18、`questionnaire-english-render` 2、`miniapp-i18n` 40、`miniapp-locale-refresh` 5（隐藏页切换后返回刷新、答案保留、只读一次、无写入、可见页立即中文、换账号丢弃迟到结果、日程页只重载一次；变异检查确认去掉修复后失败）、`miniapp-personal-archives` 13、`personal-archives-web` 2，全部通过 |
| `next build --webpack` | 通过（Turbopack 因本树 `node_modules` 为外部符号链接拒绝运行，环境限制） |

既有测试的调整：团队/荣誉沙盒测试接入 `tests/i18n-stubs.ts` 的中文模式模块；小程序 WXML 静态断言改为 `{{t.键}}` 绑定加字典原文核对；上传请求头断言加入 `x-zijing-locale: zh`；归档网页测试改用 React 静态预渲染以支持异步卡片组件，原断言全部保留。

未运行：Playwright e2e、微信开发者工具、真机、GitHub Actions、生产迁移与部署、真实 AI 调用。
