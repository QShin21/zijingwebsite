# V2 前端实施状态（网站 + 原生小程序）

2026-11-12，Claude Opus 5.5（前端唯一实现者）。分支 `new`；未提交、未推送、未部署。本文件只记录实际写入的代码与真实状态：**本轮我无法运行任何命令**，以下所有检查、构建、测试、截图、微信开发者工具编译均为「未运行 / 待父助手执行」，不得记为通过。

## 0. 本轮接续记录（2026-11-12）
- 修复父助手 2026-11-11 14:34 typecheck 报出的两处 `unknown && JSX`：`community/[slug]/page.tsx`、`teams/[slug]/page.tsx` 改为 `detail.body != null`，未改后端 `body: unknown` 合同。修复后未重新运行 typecheck。
- 完成小程序实际重建（五个标签、三个新内页、V2 模板/组件/数据层、全局样式）与网站剩余样式模块的 V2 重写（见下）。

### 0.1 第二次接续（父助手 18:04 日志的 4 项失败 + 内页结构重做）
失败项根因（均未重新运行验证）：
| 失败 | 判定 | 处理 |
| --- | --- | --- |
| tsc `tests/miniapp-content-flows.test.ts(113,82)` | 测试 harness：`as unknown as` 对象字面量使 `this` 推断为 `{}` | 改用带类型的 `pathTarget()` 测试替身 |
| V2 图片公开图未写入 `target.data.img` | 测试 harness：替身 `setData` 用 `Object.assign`，不支持微信点路径键 `'img.key'`；页面代码按微信语义正确 | `pathTarget()` 按点路径写入嵌套数据；断言未删减 |
| team-review 输入缺 `cursor-spacing="24"` | 真实代码缺陷 | 重做的 `team-review` WXML 补齐 |
| `/community/synthetic-game/join` 深链无 navigateTo | 真实代码缺口 | `lib/navigation.js` 增加 `/community/{slug}/join` 与 `#community-contacts` → 社群联系区 |

本轮实际重做（代码已写入）：
- **小程序内页 20 个**（detail、list、fixed、auth、community、signup、applications、review、staff、staff-review、activity-manage、team、team-apply、team-review、team-members、team-honors、team-profiles、team-honor-workspace、team-honor-edit、showcase-new）：统一 `zj-hero` 舞台头 + 返回、`zj-sheet` 分段表单、`zj-dock` 底部操作栏、`zj-kv` 事实表、`zj-callout` 状态条、`zj-record` 记录卡；共享模板 `common/native/native-content/club.wxml` 改用 V2 卡片；`privacy-consent` 改为底部浮层样式。处理函数、`data-*`、禁用规则、CAS 字段、隐私授权文本与 staff-review 冻结控件顺序全部保留；JS 未改（仅 community 早前的 `showcaseParams`）。
- **网站复杂页结构重做**：新增 `components/v2/TaskFrame.tsx`（舞台头 + 步骤轨 + 主流程/指引侧栏）与 `components/v2/work.module.css`（概况数字条、状态色边记录卡、提交内容/处理决定分栏、筛选条、折叠区）。已改：活动报名填写、骨干招新首页与批次申请、`/staff/manage`、代表队选拔中心 `/teams/recruitment`、`/teams/recruitment/[id]`、`/teams/apply`、`/teams/manage`、`/teams/manage/[id]`、`/teams/profiles/[teamID]`、`/teams/honors`（我的/审核视图）、`/teams/honors/[id]`、`/community/apply`、`/community/promotions`、`/community/[slug]/showcase/[id]`、`/showcase/new`、`/updates/new`、`/community/[slug]/showcase/team-honors/[team]`、社群/代表队错误边界。
- 共享组件修正：`PageHero` 返回链接包在 `nav[aria-label=面包屑]`（保留旧面包屑地标语义）；`Section` 输出同名 `id`（修复主场 `/account#todo` 等锚点此前无目标）；主题按钮可访问名称以可见文字开头（WCAG 2.5.3）；`TaskNote` 箭头 `aria-hidden`；账号页列表视图加入「全部报名/全部申请」标题区域，旧链接 `?view=history` 映射到「我的申请」；`/teams/recruitment` 已在「开放中的批次」显示的批次不再在列表重复（避免同名链接重复）；升推卡片输出 `data-promotion-source`。
- **e2e 已按 V2 DOM 改写**（保留服务端/安全断言）：`navigation-helpers`（底部标签 `主要栏目`）、`redesign`、`design-refresh`、`rebuild-shell`、`theme`、`rebuild-account`、`rebuild-activity`、`site`（导航、主场、`site.modules` 退役断言）、`team-core` / `team-core-review`（登录核对改为 V2「我的」）、`community-application`（V2 申请列表）、`community-spaces`（投稿独立页）、`club-integration`（发布页）、`content-promotions`（主场升推投影）。
- 后端事项写入 `docs/REBUILD_V2_SOL_TASKS_20261112.md`（S1–S8）。

### 0.2 第三次接续（父助手 18:47 typecheck 4 项 + 剩余前端缺口）
- **tsc 4 项 ItemRef 错误**（`teams/recruitment/page.tsx:64`、`cards.tsx` 三处 `promotionSource`）：`honor` 分支无 `id`。改为按判别字段收窄：`promotionSource(ref: EventCard["ref"])` 用 `switch (ref.type)` 只在 `event`（且 `source === "community"`）与 `communityNotice` 分支读取 `id`；选拔中心改为 `flatMap(({ ref }) => ref.type === "teamRecruitment" ? [String(ref.id)] : [])`。未改后端类型、未用 any。修复后未重新运行 typecheck。
- **`/community/review`**：V2 任务框架（舞台头、审核概况、待审核分区、记录卡左右分栏：申请人事实表 + 申请说明 + 名片核对 | 审核决定）。查询、`canPublish` 门槛、资料完整/本人同意的批准禁用规则、表单字段与文案不变；页面只保留一个 `role=status`（e2e 严格匹配）。`tests/community-contact-consent-components.test.ts` 的求值映射新增 `@/components/v2/TaskFrame`、`@/components/v2/ui` 宿主替身，断言未改。
- **`/activities` 工作台**（`QuestionnaireWorkbench`）：V2 任务框架、来源筛选条、记录卡、分页；接口、权限与标签名（`活动来源`、`编辑问卷`、`报名与统计`、`打开填写入口`、`问卷列表分页`）保留。
- **`/activities/[kind]/[id]/manage|signups`**（`SignupManager`）：舞台头（面包屑回问卷工作台、状态与授权胶囊）+ V2 容器；任务标签「当前问卷任务」、编辑器、名单、统计 DOM 不变。
- **活动详情去重**：`EventDetail` 的服务端「活动管理」区改用既有名称「管理报名问卷 / 查看报名与统计」，`ActivitySignup` 紧凑模式不再重复渲染同一组入口（无 JS 也可用）。
- **旧集合详情与 `/preview`**：`Content.tsx` 的 `Detail`（含代表队档案预览分支）改为 V2 舞台头 + 状态胶囊 + `Wrap` 容器；`[...path]` 不再套旧 `ClubFrame`；预览页改为吸顶「DRAFT」横幅（`aside[aria-label=预览状态]`）。
- **样式补齐**：`ReadingPages.module.css` 按 V2 重写（只保留 `Content.tsx` 实际引用的 60 个类）；`team-profiles/TeamProfiles.module.css` 按 V2 重写（球员卡、舞台侧栏编辑器、授权与预览）；`QuestionnaireSurface.module.css` 核对已是 V2 且覆盖全部引用类；`v2.css` 补 `designer-enable / designer-source-tools / designer-settings-section`。
- **e2e**：`site.spec.ts` V1 残留按 V2 路由合同改写（`/join/members|teams` 的「往期招新记录」、`/join/staff` 的「历史招新资料」、`/recruitment/demo-*` 仍为「已关闭」且无外部报名；预览返回链接名）；`club-theme.spec.ts` 的配色检查从旧 `ClubPages_page` 改为 `main`（V2 在 `:root` 设置 color-scheme 并继承）。

### 0.3 接口整合与回归修复（Sol S1–S8 合同落地后，2026-11-12）
按 `src/lib/v2/types.ts`、`index.ts`、`http.ts`、`home-sections.ts`、`images.ts` 的真实合同接入；未改任何后端文件。

| 合同 | 网站 | 小程序 |
| --- | --- | --- |
| S1 `signupOpen` | `/events` 增「可报名」范围标签与「只看报名开放」复选，`getCalendar({signupOpen})` 服务端先筛后分页；空状态与主场「正在招募」入口指向 `/events?signupOpen=1` | 日程增「可报名」切换（`signupOpen=1` 仅在开启时发送），切换重读第一页 |
| S2 `getCommunityHeader` | 社群布局改用轻量头投影（hue、简介、计数、待审风采、本人任职），不再读原始 CMS 文档，概览页仍按需读完整详情 | 原生社群页沿用既有读取，未改 |
| S3 批量签名 | 网站继续用 Cookie 读受控图 | `lib/v2-images.js` 重写：受控图按 ≤20 批量 `POST /api/v2/images/sign`（同 tick 合并、去重）；签名只存内存，临近到期（5 s 余量）重签；换号/退出清空并丢弃旧账号迟到回复；只接受「同一 src + `&ticket=`」的返回；公开媒体与游客仍直连；不持久化、不打印。卡片 `<image binderror="imageError">`：只重签一次，再失败显示文字封面；隐藏页/旧地址事件忽略 |
| S4 `webOnly` | 无需改动（网页均可直接打开） | 待办、管理台、申请卡改用服务端 `webOnly` 字段（`navigation.open(url, webOnly)` 与 `openTarget`），删除 key/路径白名单；其余未映射站内路径统一提示复制网页链接，旧分享链接仍可用；`/community/apply|review|promotions` 不再被当作社群 slug |
| S5 slug | 无 | 无 |
| S6 `promoted` | 主场独立「社团精选」区（活动/通知/风采），不受赛程前六影响；卡片带 `data-promotion-source` | 主场独立「社团精选」区，投影活动/通知/风采并挂图 |
| S7 `sections` | 主场按 `sections` 顺序、标题、启停渲染（`data-section`），首屏舞台与个人行不属可配置区块 | 同上（`wx:for` 渲染）；旧服务端无 `sections` 时回退默认七块 |
| S8 历史深链 | 保留原 href | `/teams/apply#team-applications-title`、`#my-establishment-applications`、`#establishment-form` → `team-apply`；`/community/apply#my-applications(-title)` → `applications`；`#application-form-title` → 申请表 |

真实缺陷修复：
- `pages/communities`：原先不订阅账号变化，加载中换号时旧账号迟到回复仍写入；现订阅 `session.subscribe`，换号即清空目录与图片并忽略旧回复，`onUnload` 退订；补 `needsLogin`。`pages/events` 同样加入换号订阅（「已报名」为私人数据）。
- V2 卡片图片原无错误处理，签名过期后懒加载图片会静默失败；现由 `imageError` 处理。

测试（已改写，未运行）：
- `tests/miniapp-content-flows.test.ts`：V2 图片三项改为批量签名合同（≤20 批量与去重、公开直连、隐藏迟到不写回、不持久化/不打印、临近过期重签、拒收伪造票据、签名失败降级、换号丢弃迟到签名、退出回退、错误重签一次）；新增原生「可报名」与主场 sections/promoted 投影两项。
- `tests/miniapp-community-flows.test.ts`：harness 以真实 `lib/v2.js`、`lib/v2-images.js` 运行，`session` 增 `token()`，`setData` 支持点路径；4 项新增失败按 V2 语义改写并保留断言：目录封面失败/离页（V2 `imageError`）、staff 入口同批次（V2 选拔中心，含不读升推接口）、换号清私有数据与迟到回复、hide 后迟到回复（后两项沿用原 `it.each`，由真实代码修复通过）。旧基线中社群进群旧功能等失败未处理。
- `tests/rebuild-native.test.ts`：新增历史锚点归一（5 例）、`webOnly` 与通用网页链接回退、静态检查无白名单。
- e2e：`content-promotions` 限定 `[data-section="promoted"]`；`site.spec` 主场改测真实 `homeSections`（重排、改标题、隐藏、全隐藏）；`rebuild-v2-shell` 增「可报名」视图。

## 1. 已实现（代码已写入）

### 1.1 设计系统与外壳（网站）
- `src/design/tokens.json` 改为 V2「紫荆赛场」色板（电光紫 #5A2BE6 / 青柠 #C5F04A / 深色舞台 #140B33→#2A148A；夜场 #0E0C17 / #A58CFF）。对比度按 `tests/design-tokens.test.ts` 门槛手算核对（未运行测试）。为兼容保留的旧键（header-bg、purple 等）映射到 V2 值。
- `scripts/build-design-tokens.mjs`：输出改为 `src/app/(frontend)/tokens.css`；原生别名扩展（stage/accent/lineStrong 等）；`--native-config` 对 `navigationStyle: custom` 页面不写导航栏颜色。`src/app/(frontend)/tokens.css` 已手写一份等价生成物，**必须由父助手重新生成**以通过 `--check`。
- `src/app/(frontend)/v2.css`：Tailwind v4 preflight + `@theme` 映射、基础排版、旧模块兼容变量（`--paper`、`--hc-*` 等）、V2 表单套件（保留逻辑的复杂表单使用的全局类：`.button`、`.member-form`、问卷/设计器/对话框等）。
- `src/components/v2/`：`Shell`（顶栏 + 手机底部五标签 + 深幕页脚 + 备案）、`NavLinks`、`ThemeToggle`（日场/夜场，cookie 持久化）、`ui`（PageHero/Section/ButtonLink/Chip/CommunityChip/StatusPill/EmptyState/ErrorState/Pager/LinkTabs/LoginWall/Img/Avatar/KeyValues/Notice）、`cards`（记分牌 DateBlock、对阵卡 MatchCard、公告行、文章/风采/社群/队伍/奖杯/招新卡、申请时间线、待办、管理台队列、回执、成员关系）、`Stage` + `StageCanvas`、`EventDetail`、`Feed`（动态流与阅读页）、`RichText`、`TeamsNav`、`data.ts`（服务端直接调用 `src/lib/v2`，401→登录、404→CMS 重定向/404）、`copy.ts`、`format.ts`。
- 根布局 `src/app/(frontend)/layout.tsx` 改用 V2 外壳；不再导入 style.css / field.css / design.css / visual-direction。
- `PageHeading`、`PageState`、`_club/ClubPages.module.css`、`community-pages/CommunityPages.module.css`、`account-pages/AccountPages.module.css`、`team-pages/TeamPages.module.css`、`activity-pages/ApplicationFlow.module.css`（报名/骨干申请流程）、`RouteLoading` 重写为 V2 视觉（类名与接口不变），使保留逻辑的工作台、代表队流程与报名面板统一进入 V2 框架。

### 1.2 网站页面（接 V2 合同）
| 路由 | 数据 | 状态 |
| --- | --- | --- |
| `/` 主场 | `getHome` | 新：舞台 + Canvas 光效 + NEXT UP 滚动条、焦点对阵卡、赛程轨道、正在招募、公告、我的主场记分牌/三步加入、社群墙、赛场高光、关于 |
| `/events`、`/events/[slug]` | `getCalendar`、`getEventDetail` | 新：范围标签、筛选、按日分组；详情含报名侧栏（沿用 `ActivitySignup`）、外部渠道、管理入口 |
| `/announcements`、`/announcements/[slug]`、`/gallery`、`/gallery/[slug]`、`/news`、`/news/[slug]` | `getFeed`、`getArticle` | 新：动态流（六类标签）、阅读页、相册分页 |
| `/about`、`/contact`、`/privacy`、`/join`、`/join/members`、`/join/teams` | `getFixedPage`、`getRecruitmentCenter` | 新；隐私页保留已确认的运营者与保留期文本 |
| `/community`、`/community/[slug]`（布局）、`/updates`、`/updates/[id]`、`/showcase` | `getCommunities`、`getCommunity`、`getContacts`、`getCommunityPosts`、`getEventDetail`、`getArticle`、`getShowcase` | 新：社群色头带 + 分区标签、联系管理员（原名片弹窗逻辑）、管理菜单；风采「我的/审核」视图保留原审核组件 |
| `/teams`、`/teams/[slug]`（新路由）、`/teams/honors`、`/teams/recruitment` | `getTeams`、`getTeam`、`getHonors`、`getRecruitmentCenter` | 新：代表队中心三段、队伍页、按年荣誉墙；荣誉「我的/审核」与选拔中心下半部分保留原工作流（撤回、离队） |
| `/account` | `getMe`、`getManage`、`getMySignups`、`getMyApplications` | 新：身份卡、待办、我的赛程、申请进度、我的队伍、管理台、账号设置，`?view=signups|applications` 分页 |
| `/login`、`/register`、`/account/reset` | 原 Server Actions | 渲染层重做（分栏舞台 + 表单卡）；表单逻辑、字段、校验文案不变 |
| 404 / error / loading | — | V2 |
| `(design)/design-preview` | — | 改为 V2 组件/表单样张（仅非生产、需登录） |

### 1.3 原生小程序
- 新：`lib/v2.js`（`/api/v2/*` + JWT、北京时间格式化、视图投影）、`lib/v2-images.js`（受控图片登录后带 JWT 下载、公开媒体直连、并发 4、账号变化清缓存、隐藏后不写回）、`templates/v2.wxml|wxss`（记分牌日期、对阵卡、公告行、文章/风采/奖杯/社群/队伍/招新卡、申请时间线、分区头、空/加载/错误/登录墙）、`components/zj-stage`（Canvas 2D 粒子光效，视口外/页面隐藏暂停，不发请求）。
- `app.wxss` 重写为 V2（类名保留，保留逻辑的内页自动换装）；`app.json` 五个标签改为 主场·日程·社群·代表队·我的；新增 `pages/teams`、`pages/team-home`、`pages/recruitment`、`pages/showcase-new`；`pages/explore` 保留为跳转页（旧分享链接仍可打开）。
- 重做页面：`home`（自定义导航 + 舞台 + 记分牌）、`events`、`communities`、`teams`、`account`、`team-home`、`recruitment`、`showcase-new`（A16 上传 + A17 投稿，含隐私授权）；`community` 风采区新增投稿入口。
- `lib/navigation.js`：标签与 V2 深链映射（`/teams`、`/teams/recruitment`、`/teams/{slug}`、`/community/{slug}/showcase/new`、网页专属工作台复制链接）。
- 内页路径与 JS 逻辑保留：`detail`、`list`、`fixed`、`auth`、`community`、`applications`、`review`、`signup`（问卷运行时）、`activity-manage`、`staff`、`staff-review`、`team`、`team-apply`、`team-review`、`team-members`、`team-honors`、`team-profiles`、`team-honor-workspace`、`team-honor-edit`、`showcase-new`、`privacy-consent`。**WXML 与 WXSS 已在 2026-11-12 第二次接续中按 V2 结构逐页重做**（见 §0.1），`tests/rebuild-native.test.ts` 断言这些内页使用 `zj-hero` 框架且不再含旧 `native-page`/`plain back` 结构。

### 1.4 测试（已改写，未运行）
- `tests/rebuild-native.test.ts`：28 个页面、五个 V2 标签、V2 模板/API 使用、舞台暂停钩子、V2 深链。
- `tests/miniapp-theme.test.ts`：V2 原生颜色期望值。
- `tests/miniapp-content-flows.test.ts`：前五个首页/日程客户端用例改写为 V2 实现（Sol 已确认这些为客户端 VM 断言、无服务端断言）；其余用例未动。
- 新增 `tests/e2e/rebuild-v2-shell.spec.ts`（访客主场 200、单一 h1、跳到正文、5 宽度无横向溢出、底部标签、夜场持久化、减弱动效、成员区登录跳转）。

## 2. 验证清单（按顺序；本轮均未运行）

接口整合轮（§0.3）改了网站、小程序 JS/WXML/WXSS 与测试；未改 tokens.json，无需重新生成 tokens/图标。

1. `pnpm typecheck`
2. `pnpm lint`
3. `git diff --check`
4. `node scripts/build-design-tokens.mjs --check --native-config`
5. 本轮定向单元（先跑）：`pnpm vitest run tests/miniapp-content-flows.test.ts tests/miniapp-community-flows.test.ts tests/rebuild-native.test.ts tests/community-contact-consent-components.test.ts`
   - 预期：`miniapp-community-flows` 中 4 项新增失败消失；该文件里旧基线失败（`joinAction`、`community-joins` 页面不存在等已移除的进群旧功能）**仍会失败**，属旧基线，未处理。
6. 其余定向单元：`pnpm vitest run tests/team-honor-editor-component.test.ts tests/team-honor-feedback.test.ts tests/miniapp-staff-review-lifecycle.test.ts tests/miniapp-community-contact-consent.test.ts tests/miniapp-team-workspaces.test.ts tests/miniapp-team-honors.test.ts tests/miniapp-privacy-consent.test.ts tests/miniapp-theme.test.ts tests/miniapp-startup.test.ts tests/miniapp-wxml-bindings.test.ts tests/design-tokens.test.ts tests/v2-contract-followups.test.ts`
7. `pnpm test`（全量，涉及数据库时只用隔离合成库），与 `full-tests-20261111-1851.log.clean` 的失败签名对照。
8. `pnpm miniapp:check`（本轮新增 WXML/JS，主包体积需复测）
9. `pnpm build`
10. e2e（隔离合成环境，按 README 准备）：
    - 外壳：`pnpm exec playwright test tests/e2e/rebuild-v2-shell.spec.ts tests/e2e/redesign.spec.ts tests/e2e/design-refresh.spec.ts tests/e2e/theme.spec.ts tests/e2e/rebuild-shell.spec.ts`
    - 本轮合同相关：`pnpm exec playwright test tests/e2e/site.spec.ts tests/e2e/content-promotions.spec.ts`（主场 `homeSections` 与「社团精选」）
    - 其他流程：`pnpm exec playwright test tests/e2e/community-application.spec.ts tests/e2e/club-recovery.spec.ts tests/e2e/activity-signups.spec.ts tests/e2e/team-core.spec.ts tests/e2e/team-core-review.spec.ts tests/e2e/staff-recruitment.spec.ts tests/e2e/staff-recruitment-boundaries.spec.ts tests/e2e/community-spaces.spec.ts tests/e2e/club-integration.spec.ts tests/e2e/rebuild-account.spec.ts tests/e2e/rebuild-activity.spec.ts`
    - 视觉库专用（需 `*_clubqa_synthetic` 库）：`tests/e2e/club-theme.spec.ts tests/e2e/club-visual.spec.ts`
11. 视觉验收（截图 + axe，390/1440 × 日场/夜场）：主场（含区块重排/隐藏与社团精选）、`/events?signupOpen=1`、社群布局头带、`/community/review`、`/activities`、manage/signups、`/recruitment/demo-*`、`/preview/*`、`/teams/manage[/id]`、`/staff/manage`、`/community/apply|promotions`。当前浏览器截图通道受限（见协调记录），未做。
12. 微信开发者工具编译与真机预览：重点核对签名图（含懒加载过期后的重签与文字封面回退）、日程「可报名」、主场区块顺序/社团精选、待办/管理台「请在网页端完成」复制、历史锚点跳转。Windows 工具可用性未核实，未做。

### 2.1 后端合同衔接（Sol 所有，前端不抢写）
S1–S8 已按 `docs/REBUILD_V2_SOL_FOLLOWUPS_20261112.md` 的真实合同接入（见 §0.3）。仍需后端/运营确认：S7 旧 `site.modules` 不迁移运营意图，若需要须另行在 CMS 配置 `homeSections`；S5 生产库 slug 冲突审计未执行。前端未改任何后端文件。

删除候选（**删除前请 `grep -r` 复核无引用**；本轮未删除任何文件）：
- 网站：`src/components/visual-direction/**`、`src/app/(frontend)/style.css`、`src/app/(frontend)/field.css`、`src/app/(design)/design.css`、`src/components/PromotedContent.tsx`、`src/components/MemberUI.tsx`、`src/components/activity-pages/PublicPages.tsx` 与 `ActivityDetail.tsx`（仅二者互相引用）、`src/components/PageHeading.tsx`（第三次接续后已无引用）、`src/app/(frontend)/_club/ClubPage.tsx` 与 `ClubPages.module.css`（已无页面引用；`community-contact-consent-components.test.ts` 中旧映射可一并清理）、`src/components/community-pages/CommunityPages.tsx`（组件已无引用，同目录 `CommunityPages.module.css` 仍被多个组件使用，**不可删**）、`src/app/(frontend)/staff/manage/_loading.tsx`。`team-pages/TeamPageParts.tsx` 仍被 `TeamHonorsPanel` 引用，保留。
- 小程序：`assets/explore*.png`、`styles/native.wxss`、`styles/native-reading.wxss`、`assets/zijing-stage*.webp`（均需复核引用与 `miniapp:check` 体积）。

## 3. 客户端渲染边界与降级
- 网站：`StageCanvas`（主场舞台、登录页）在浏览器本地以 Canvas 2D 渲染粒子、连线、移动光斑与指针交互；DPR ≤ 2；`IntersectionObserver` 视口外暂停、`visibilitychange` 后台暂停；`prefers-reduced-motion` 只绘制一帧静态画面；CSS 光扫、滚动条、脉冲在减弱动效下停用。无网络请求、无服务端逐帧生成。
- 小程序：`zj-stage` 用 Canvas 2D（`canvas.requestAnimationFrame`），页面隐藏/滚出视口暂停；画布不可用时保留静态渐变舞台。
- 服务器只负责数据、鉴权、权限与业务决定；所有特效失败时内容与流程完整可用。
- 实际验证：**均未运行**（性能、帧率、暂停行为、减弱动效未实测）。

## 4. 后端合同问题与观察（不改后端）
已整理为可执行任务说明：`docs/REBUILD_V2_SOL_TASKS_20261112.md`（S1 日程可报名筛选、S2 社群头减负、S3 小程序受控图片、S4 网页专属队列标记、S5 队伍 slug 保留词、S6 主场升推投影、S7 `site.modules` 退役确认、S8 账号旧深链说明）。

## 5. 未完成 / 未验证
- 全部检查、测试、构建、截图、axe、微信编译：**未运行**，不得记为通过。
- e2e 中已明确退役的旧断言（如实记录，未为通过而恢复旧功能）：账号页「我的进群记录」（早前重置已移除）、主场 `site.modules` 模块排序/开关（`Site.ts` 注明 V2 不使用）、主场分模块升推区（改为 `data-promotion-source` 投影，见 S6）、访客 `/` 跳转 `/events`（V2 代理允许访客主场）。`site.spec.ts` 中「三类招新历史标题」「`/recruitment/demo-*`」等 V1 旧断言未改写，预计仍失败，需按产品确认后处理。
- 第三次接续已完成 `/community/review`、`/activities` 工作台与 manage/signups、旧集合详情、`/preview` 的 V2 结构，以及三个剩余样式模块（见 §0.2）。
- 复杂表单组件（`TeamCoreControls`、`StaffApplication`、`SignupBuilder`、`Questionnaire`、`CommunityApplicationForm`、`ShowcaseForm`、`TeamHonorEditor`、`PromotionControls`、`StaffBatchEditor`）内部 DOM 判断为合理（字段、分组、错误与状态区语义清楚），保留结构；所用全局类均已由 `v2.css` 表单套件按 V2 呈现（第三次接续补齐 3 个缺失的设计器类），外层页面均已进入 V2 框架。若视觉验收发现个别控件仍显旧，再按截图定点调整。
- 小程序：页面级真机/开发者工具验证缺失；包体积（目标 ≤1.2 MiB）以父助手 `miniapp:check` 为准（上次 864512 bytes，本轮新增 WXML/WXSS 后未复测）。
- `pages/team`（代表队事务）与 `pages/team-home`（队伍页）分工：`pages/team` 承载入队/离队等写流程且有测试覆盖，队伍页另设 `team-home`。
