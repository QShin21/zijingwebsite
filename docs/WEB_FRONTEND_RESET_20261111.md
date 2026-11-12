# 网页前端重置「紫荆主场」：实现记录

记录日期：2026-11-11（北京时间）。执行：Claude Code `claude-opus-5-5`，max effort。

## 1. 当前状态

- **实现阶段已完成，验证尚未进行。** 本文件列出的视觉与版式改动均已写入工作树；本会话只能使用文件读写工具，没有运行任何命令、构建、测试、浏览器或 axe 检查。下文「验证」一节如实区分已有记录与未运行项。
- 没有提交、推送、部署、迁移、CMS 发布或小程序上传；未访问生产环境、凭据、`.env` 或真实私人资料；未修改 `miniprogram/`、`src/app/(payload)`、API `route.ts`、`actions.ts`、`src/lib`、`src/collections`、迁移、测试或 `CLAUDE.md`。
- 会话历史：首轮会话写入外壳、首页、通用层及活动/工作区等文件后，因服务商 5 小时用量上限中断（提示 `You've hit your 5-hour limit · resets 5:40am (Asia/Tokyo)`）。协调者在中断时记录了中间状态检查（见第 6 节）。本轮从同一工作树续做，补完社群、账号/登录、阅读、问卷、申请流程、代表队/荣誉/招新/队员资料各界面，并修正首轮遗留的两处层叠问题。
- 后端兼容合同见 `WEB_RESET_BACKEND_CONTRACT_20261110.md`，由用户指定的后端审查独立负责；本轮前端改动按该合同保持全部字段、动作与权限分支。

## 2. 阅读过的 Next.js 16 指南

依赖安装后，从 `node_modules/.pnpm/next@16.3.5…/node_modules/next/dist/docs/` 阅读：

- `01-app/01-getting-started/11-css.md`：全局 CSS 可在布局导入；生产构建按导入顺序合并，开发模式顺序可能不同，需以 `next build` 结果为准。据此：新的网页身份层在根布局最后导入；凡要覆盖 CSS Modules 的地方都在对应模块内修改，不依赖全局层的加载先后。
- `01-app/01-getting-started/04-linking-and-navigating.md`：`<Link>` 预取、`useLinkStatus`。导航仍沿用原 `Pending` 组件和原 `prefetch` 设置。
- `01-app/01-getting-started/05-server-and-client-components.md`：`"use client"` 文件的导入会进入客户端包。新增的 `CourtMotif` 是无 hook、无服务端依赖的纯 SVG，可被客户端 `error.tsx` 通过 `PageState` 引用。
- 未使用 `next/font`（会在构建时拉取远程字体），全部采用系统字体栈；未引入新依赖。

## 3. 设计决策

**身份：紫荆主场（Home Court）。** 暖象牙阅读纸面＋深茄紫「舞台」＋克制的梅紫强调色，配合报纸式规则线与记分牌数字。

1. **色彩来源不分叉。** `src/design/tokens.json` 生成的 `--z-*` 仍是共享角色的唯一来源（小程序与 token 对比度测试都读取它），本轮未改动 tokens 文件。网页新增角色写在 `src/components/visual-direction/home-court.css`：
   - `--hc-stage` 深茄紫舞台（浅色 `#2a1631`，深色 `#2b1733`）及其文字/次要文字/强调色/线条；
   - `--hc-ticket*` 首页票根卡片（浅色主题用纸面，深色主题用抬升茄紫）；
   - `--hc-rule` 编辑规则线（浅色为墨色，深色为 `#a59dab`）、`--hc-wash` 浅梅紫衬底；
   - 人工核算的对比度：舞台正文 14.9:1、次要文字约 9.6:1、强调色约 9.6:1；深色票根正文 12.7:1、次要 7.9:1；梅紫衬底上的次要文字约 5.1:1（浅）/7.7:1（深）。
2. **字体与中文排版。** 标题取消原有负字距（会让中文笔画相碰），统一 0.01–0.02em；标题字重 800；正文行高 1.75–1.9。日期、编号、计数使用「记分牌」窄体数字栈（Bahnschrift / DIN Alternate / Roboto Condensed / Arial Narrow，缺失时回落系统无衬线），`tabular-nums`。
3. **版面节奏。** 页面刊头以「双线」收尾（`3px double`）；章节以 2px 规则线开头并带两位编号；列表行用 1px 细线。章节编号由 CSS 计数器 `hc-chapter` 产生：`main` 重置，各模块的章节标题递增；`::before` 使用 `content: counter() / ""` 替代文本写法，对辅助技术隐藏编号且不改变标题文字与可访问名称（同时保留无替代文本的回退声明）。首页章节编号直接写在 `aria-hidden` 元素中，位于 `h2` 之外。
4. **原创图形。** `CourtMotif`：原创「战术板」线稿（场地线、中圈、禁区弧、O/X 站位与 Z 字跑位虚线，呼应原 Z 形界面标识）；首页舞台、页脚与 404/错误页使用，`aria-hidden`、不可聚焦。舞台底纹为 22px 点阵（LED 记分牌意象）。首页活动以「票根」呈现：日期存根、打孔虚线与半圆缺口。未使用远程图片、虚构统计或装饰徽章。
5. **组件语言。** 任务面板（表面色＋顶部 3px 梅紫边＋圆角底部）、梅紫衬底插页（左侧 4px 边）、胶囊状态（圆点＋描边，颜色继续来自 success/warning/danger/info 语义 token）、虚线「预留席位」空状态、胶囊式页内目录。
6. **深色主题。** 页面底色与页眉色仍由 token 决定（测试固定校验）；深色下舞台为更亮的茄紫，以与近黑纸面区分；票根改为抬升茄紫。全部新颜色都提供深浅两套取值。
7. **动效与无障碍。** 只有颜色/边框过渡和箭头 3px 位移；`prefers-reduced-motion` 下全部关闭（沿用全局 `!important` 规则）。焦点环保持 3px；舞台上的焦点环改用浅紫强调色以保证可见。强制色模式为舞台、面板与状态补边框。所有点击目标保持 ≥44px。

## 4. 改动范围（逐文件）

| 文件 | 本轮改动 |
| --- | --- |
| `src/components/visual-direction/home-court.css`（新增） | 网页角色变量（深浅两套）、中文标题字距、章节计数器重置、记分牌数字、kicker、舞台、战术板颜色、箭头位移、减弱动画/强制色/打印。舞台按钮悬停选择器提高到与 `design.css` 同级，避免悬停时深字配深底 |
| `src/components/visual-direction/CourtMotif.tsx`（新增） | 原创战术板 SVG（`crop` 参数控制裁切） |
| `src/components/visual-direction/DesignUI.tsx` | 页眉品牌改为茄紫方块标识＋站名（英文副标 `aria-hidden`）；页脚改为全宽舞台（kicker、站名、两组链接、战术板条带、版权与两条备案链接、回到页首）；`SectionHeading` 支持 `index` 编号（位于 `h2` 外、`aria-hidden`） |
| `src/components/visual-direction/DesignNavigation.tsx` | 移动菜单链接加入 `aria-hidden` 两位编号与文本容器；原链接集合、顺序、`aria-current`、Escape/外部点击/尺寸变化关闭、`data-enhanced` 全部保持 |
| `src/components/visual-direction/SiteChrome.module.css` | 页眉顶部茄紫带、72px 栏、当前项 3px 下划线；移动菜单为右对齐卡片（左缘保持在页边距内）；舞台页脚；320/390/600/1160 断点 |
| `src/components/visual-direction/Home.tsx`、`HomeSections.tsx`、`Home.module.css` | 首页重组：舞台刊头（站名、北京时间当日日期、kicker、主标题、主次行动、战术板、真实首个活动票根或站点主图）、参与入口条、骨干招新公告、按 CMS 模块顺序编号的章节（活动票根行、社群卡片、参与三入口、荣誉台账、队伍卡、动态/影像、关于）。活动状态按原 `eventState` 文本加语气色。 |
| `src/components/visual-direction/PromotedContent.module.css` | 社群精选内容改为梅紫衬底插页 |
| `src/app/(design)/design.css` | 外壳基底：标题字距、主题切换胶囊、按钮/文字链接、章节标题（规则线＋编号）、空状态、状态胶囊 |
| `src/app/(frontend)/field.css` | 旧通用类兼容层：刊头双线、kicker、按钮间距与字重、输入悬停、文字链接、标签胶囊、对话框顶边、环境提示条改为舞台色 |
| `src/app/(frontend)/layout.tsx`、`src/app/(design)/layout.tsx` | 最后导入 `home-court.css` |
| `src/components/PageHeading.module.css` | 面包屑、kicker、加大标题、双线收尾 |
| `src/components/PageState.tsx`、`PageState.module.css` | 404/错误页加入战术板底图（不越出容器宽度）、kicker、任务面板式帮助区 |
| `src/components/activity-pages/ActivityPages.module.css`、`PublicPages.tsx` | 活动/通知/影像列表刊头（新增 kicker「紫荆主场 · 活动/通知/影像」）、筛选面板、票根式活动与通知行、胶囊状态、详情刊头双线、报名信息任务面板、骨干招新章节编号；禁用的 `.button` 不再显示可用或悬停颜色 |
| `src/components/activity-pages/Workspace.module.css` | 工作区章节编号、审核面板、范围提示、骨干招新公告卡（时间存根） |
| `src/components/activity-pages/ApplicationFlow.module.css` | 报名/申请流程头部规则线与 kicker、步骤记分牌圆点、状态胶囊、提示衬底、回执规则线、编辑提示面板、紧凑卡片；禁用按钮配色 |
| `src/components/activity-pages/QuestionnaireSurface.module.css` | 禁用控件改用共享禁用色（不再 0.6 透明）；模板卡/AI 预览/条件删除按钮改用 token 颜色，修复深色主题下沿用 `style.css` 硬编码浅色导致的低对比；错误汇总、说明、结果提示统一左侧强调边 |
| `src/app/(frontend)/join/staff/(index)/page.tsx` | 刊头新增 kicker「参与紫荆 · 骨干招新」 |
| `src/components/community-pages/CommunityPages.module.css`、`src/app/(frontend)/community/(index)/page.tsx` | 社群目录刊头（新增 kicker）、目录行悬停衬底、组织社群插页；社群主页标题区双线、联系管理员任务面板、章节编号、近况日期数字、去向卡片；申请/审核/升推的回执、决定面板、状态胶囊、空状态；文章页与发布侧栏 |
| `src/app/(frontend)/_club/ClubPages.module.css` | 社群/代表队共享框架：刊头双线、kicker 字重、按钮、面板圆角、当前分区、空状态预留席位、标签胶囊、步骤数字、表单面板与提示插页 |
| `src/components/team-pages/TeamPages.module.css` | 页内任务目录改为胶囊、左侧任务面板、章节编号、状态胶囊、提示衬底、编辑与审核面板、回执刊头与侧栏、荣誉台账（年份与日期用记分牌数字、成绩胶囊） |
| `src/components/team-profiles/TeamProfiles.module.css` | 队员简介面板章节编号、圆形头像与舞台色首字占位、保存/错误提示、编辑说明面板、预览面板 |
| `src/components/account-pages/AccountPages.module.css` | 登录/注册/重设：标签式入口、加大标题、表单任务卡、右侧茄紫「下一站」舞台（焦点环用浅紫）；个人中心：胶囊页内目录、编号章节、待处理面板、记录行、状态胶囊、视图切换胶囊、账号资料卡、管理工作台卡片网格 |
| `src/components/account-pages/ReadingPages.module.css` | 长文排版、预留席位空状态、参与入口行、卡片、侧栏任务面板、状态胶囊、分页数字、阅读侧栏、筛选面板与结果规则线、动态页侧栏（侧栏标题不参与编号）、代表队目录与档案（介绍、队员简介、荣誉、阵容、赛季依次编号）、荣誉年份、隐私保留摘要 |

## 5. 保留的功能与固定合同

- 所有路由、链接目标与文字、表单字段名、提交动作、处理函数、返回值与错误文本、权限分支、`data-*` 钩子和 `id` 均未改动。新增内容限于：首页刊头的站名/日期条与「紫荆主场」kicker、页脚 kicker、首页活动行的星期与「地点 /」前缀、三处内页 kicker 段落，以及装饰性的 `aria-hidden` 编号和图形。
- 主题：服务端按 `zijing_theme` cookie 初始化 `data-z-theme`；无偏好或无效值为浅色；`ThemeSwitch` 的按钮名称、`aria-pressed`、cookie 写入与 meta 更新逻辑未改。
- 测试固定的外观合同继续满足（按源码核对，未实际运行）：`body` 背景为 `tokens.paper`，浅色页眉 banner 背景为 `tokens.light["header-bg"]`；禁用输入背景为 `disabled-bg`、提交中按钮不透明度为 1；`ClubPages_page` 继承当前 `color-scheme`，且不出现在 `/events`、`/activities`、`/join/members`；匿名移动导航链接顺序为 `/events`、`/announcements`、`/register`、`/login`，匿名主导航仅两项；匿名 `/events` 页面仍只有一个 `summary`；首页 `[data-section="events"]`、`[data-section="join"]` 的 `h2` 文本与顺序、事件模块关闭时首页不出现活动链接；跳到正文为第一个 Tab 目标；页面只有一个 `main h1`。
- 减弱动画下 `scroll-behavior` 为 `auto`、社群卡片过渡时长为 `0s`（全局规则保留）。
- 新增装饰定位元素均在 `overflow: hidden` 容器内或不超出容器宽度，按 320/390/768/1440 宽度手工核算未发现横向溢出点（页眉在 320px 下约 279/288px）。

## 6. 验证情况

### 本轮（续做）

本轮没有执行任何命令或浏览器检查。以下各项**均未运行**：类型检查、ESLint、Vitest、Playwright、axe、生产构建、视觉截图、键盘与读屏实测、320/390/768/1024/1440 实测、深浅主题实测。上节的合同核对只基于阅读源码与测试文件。

### 协调者记录的中间状态（首轮中断时，不覆盖本轮改动）

- 2026-11-10 16:29 UTC HTTP 冒烟 10/10 通过，见 `docs/evidence/web-reset-http-intermediate-20261110.json`。
- 2026-11-10 16:31 UTC：类型检查通过；282 项入口合同与逻辑检查通过；当时改动文件的定向 ESLint 通过；全仓 ESLint 有 4 个与 HEAD 一致、本轮未改文件中的既有错误；隔离合成库中的 Webpack 生产构建退出 0。见 `docs/evidence/web-reset-intermediate-validation-20261110.json`。
- 浏览器测试当时受执行环境限制（Chromium `process_singleton_posix.cc` EPERM），未进入业务断言，不能据此声明 E2E 或视觉通过。
- 这些结果早于本轮的社群、账号、阅读、问卷、申请、代表队、队员资料等改动，不能代表最终状态。

### 需要协调者复跑

1. `pnpm typecheck`、改动文件定向 `eslint`、`pnpm test`（隔离数据库）、`pnpm build`。
2. Playwright：`theme`、`rebuild-shell`、`design-refresh`、`redesign`、`site`、`club-theme`/`club-visual`（需 `*_clubqa_synthetic` 库）、`community*`、`activity-signups`、`staff-recruitment*`、`team-*`、`content-promotions`、`registration-*`。
3. axe（wcag2a/2aa/21aa）覆盖首页、社群、社群申请、代表队、个人中心、登录/注册/重设，深浅两套主题。舞台区域有背景点阵，axe 可能把其中文字对比记为「需复核」，需人工按第 3 节数值确认。
4. 视觉走查：首页舞台与票根、页脚、移动菜单、个人中心、登录页「下一站」、问卷制作器的模板/AI 对话框（深色主题重点）、代表队档案编号顺序。

## 7. 已知风险与未做事项

- **CSS 计数器替代文本**：`content: counter() / ""` 需要较新的浏览器（Chrome 77+、Safari 17.4+、Firefox 128+）。旧浏览器使用回退声明，编号可能被读屏读出。若构建压缩器只保留其中一条声明，编号显示或隐藏会随之变化，但都不影响标题文字。
- **`:has()`**：社群页用它避免章节前出现双线；不支持的浏览器会多显示一条细线。
- **字体**：记分牌数字依赖系统字体（Windows Bahnschrift、Apple DIN Alternate），Linux 等环境会回落到系统无衬线，风格会弱一些。
- **页面刊头没有页码**：`PageHeading` 只用 kicker 与双线建立层级。编号只出现在章节与首页，没有按导航顺序给页面编号，因为导航由 CMS 配置，顺序可能变化。
- **遗留样式**：`src/app/(frontend)/style.css` 仍有大量旧类（含负字距与硬编码颜色）。核对后，它们要么已被 token 层覆盖，要么当前没有使用；本轮未清理，避免影响未覆盖的旧页面。
- **设计预览页**：`/design-preview/*` 继承新外壳与基础样式，未逐页精修。
- **首页日期**：显示服务器处理请求时的北京时间日期，不是期号。
- **原生小程序**：未改动；网页的新色彩角色不会进入小程序。


## 接续实现与最终源码 HTTP 检查

原 Claude Code 会话已以 `claude-opus-5-5` / max 完成剩余前端源码实现并真实退出 0，未出现权限拒绝。完整模型回执留在云端工作目录，仓库证据仅存摘要，不含会话凭据。最终源码的隔离合成数据库 HTTP 冒烟 10/10 通过、执行退出 0；它不验证登录后交互、布局、键盘或视觉。可用浏览器工具无法连接命令内环回服务，之前 Chromium 启动的 Unix socket 限制仍未解除，没有绕过。证据见 `docs/evidence/web-reset-frontend-resumed-20261111.json`。最终类型、lint、合同及构建复核仍由协调者安排；未提交、推送或部署。
