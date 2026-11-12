# V3「黑曜竞技场」视觉返工状态

2026-11-12，Claude Opus 5.5（唯一前端作者），分支 `new`，基于 `dd3aad4b71c85f34ad96d0b49a6f1dd80c7fbfeb`。未提交、未推送、未部署；未改 `src/lib/**`、`api/**`、`actions.ts`、collections/globals/migrations/payload/proxy 或后端测试；未删除文件。**我无法运行命令或打开浏览器/微信工具：以下没有任何截图、测试或构建结果，不能视为视觉验收。**

## 0. V3.1 修复（父助手 Firefox 静态 SSR 截图 16 张后的反馈）
父助手已核：桌面黑曜竞技场明显提升；三个生成资产已存在并检查。下列两处按根因修复（未重新截图，待复核）：

| 问题（390px） | 根因 | 修复 |
| --- | --- | --- |
| 首页大六边形 Z 徽面大半被右侧裁掉，右下只剩半个巨大 Z | `ArenaArt` 只有一个 `viewBox 0 0 1600 900` + `xMidYMax slice` 的横版构图，徽面固定在 x=1000±106；手机舞台为竖向，可见范围约 x≈550–1050，徽面与赛台中心都落在可见区外 | `ArenaArt` 改为两套构图：≥641px 沿用横版不变；≤640px 使用独立竖版 SVG（`viewBox 0 0 900 1600`，自有渐变 id，不复用桌面位置/translate）——赛台与单座立碑位于右下安全区，光束自右上落下，顶部向下的可读性遮罩，**缩小且完整**的徽面（半径 64，位于赛台上方 x 486–634）。所有元素位于 x 120–820、y 760–1560 安全区内（按 390×600–900 的 slice 推算） |
| 社群列表搜索框右边框溢出视口（左 16px、右侧被裁） | `.search` 是可换行 flex，`<input>` 作为 flex 项保留 `min-width:auto`＝自身固有宽度（约 20 个平均字符；CJK 回退字体下更宽）＋内边距与边框，超过 358px 内容宽度后无法收缩 | `.search` 改为 `grid-template-columns: minmax(0,1fr) auto`；子项 `min-width:0`、`box-sizing:border-box`；输入框 `width:100%`；「查找社群」与输入同行；有查询词时「全部社群」在手机上独占一行，≥640px 三列同行 |

同类加固：共享 `layout.filters`（日程等筛选）中的 label 增 `min-width:0`，`select/input` 增 `width:100%`、`min-width:0`、`box-sizing:border-box`，避免长选项或月份控件在手机上撑破（复选框筛选仍为 20px，选择器优先级更高）。

小程序一致性（未在微信工具或真机验证）：`zj-stage` Canvas 同步竖版构图规则——只保留一座立碑并收进右边缘以内（原右侧立碑在窄屏会越出画布），移除位于文案后的左侧立碑，徽面缩小为 `0.085×短边` 并落在赛台中心上方，完整可见。

复核重点：390px 首页（游客与成员、有/无焦点活动卡）舞台右下徽面完整且不与文字冲突；`/community` 与 `/community?q=合成` 在 390px 无横向溢出、按钮同行；`/events` 筛选在 390px 无溢出；1440px 首页与上次截图一致（横版未改）。

## 0.1 V3.2 修复（父助手 Firefox 长页截图 1440×3200 / 390×4200 反馈）
卡片、日期牌、公告、招募与页脚文字清晰；唯一问题按根因修复（未重新截图，待复核）：

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| 手机夜场样张中横向对阵卡轨道下方出现刺眼的白色原生滚动条带（约 y≈2015） | 共享 `layout.rail` 只设了 `scrollbar-width: thin`，没有 `scrollbar-color`；Linux 上的 Firefox 用平台默认浅色轨道绘制，夜场下形成白带 | `html` 设置继承型 `scrollbar-color: color-mix(in srgb, var(--z-ink) 34%, transparent) transparent`（随 token 切换日夜，所有滚动区域继承：轨道、表格、代码块、对话框）；`.rail` 显式同色并补 Safari `::-webkit-scrollbar`（6px 细滑块、透明轨道）。**保留可见滚动条**与 scroll-snap、下一张卡片露出的提示，未隐藏滚动能力 |
| （同类排查）舞台 NEXT UP 跑马灯在减弱动效下变为可手动滚动 | 舞台为常驻黑曜层，日场下原生滚动条会是浅色 | `.tickerViewport` 在减弱动效时使用固定浅色半透明滑块 + 透明轨道 |

其余滚动区域已核对：`ui.tabs`、社群分区导航、队伍任务导航、社群旧标签为隐藏滚动条的触控横滑（原样）；社群联系对话框、账号对话框、问卷对话框/设计器均在主题内容面上，继承新的随主题滚动条。小程序 `scroll-view` 已关闭滚动条（`show-scrollbar="{{false}}"` 或未启用 enhanced），无需改动。

日期说明：父助手正在只修改**隔离合成视觉夹具**的活动日期（由 2099 年改为未来 2–5 天、共 4 场），以去掉「还有 26610 天」的误导倒计时并测试整行布局；**前端真实日期/倒计时逻辑未改动**。之前的手机修复（徽面构图、社群搜索）将随此次一起重拍。

## 1. 对上一版（V2）的批判与新方向
- V2 问题：电光紫 `#5A2BE6` 同时承担按钮、底色、舞台渐变、画布光与标签，青柠到处点缀，层级扁平；首屏是「渐变 + 旋转锥形光 + 115° 斜纹 + 透视网格地板 + 粒子连线」模板堆叠，没有构图主体；卡片兜底是字母方块与 emoji；小程序是网页缩小版。
- V3 方向「黑曜竞技场」：
  - **背景/舞台层**：黑曜石 `#0b0a11` / 深靛 `#1c1430`（夜场 `#08070d` / `#1a1029`），用于首屏舞台、顶部 HUD、手机标签栏、页脚、日期牌与荣誉卡。
  - **内容面**：日场银白 `#f2f1f5` + 纯白卡片 + 钢灰描边；夜场石墨 `#0e0d14` / `#17151f`。不再整页紫色。
  - **身份/交互层**：清华紫 `#660874`（夜场提亮 `#d69be3`）用于按钮、链接、焦点、选中边。
  - **强调层**：冠军金 `#e3b04b`（夜场 `#f0c060`）只用于当前态下划线、日期牌顶线、扫描弧、重要徽面描边与「LIVE/精选」。
  - **主视觉**：原创矢量竞技场（透视赛台环、刻度、金色扫描弧、两座拉丝金属立碑、体积光束、悬浮六边形品牌徽面，自有「Z」标，不使用校徽/真实赛事/人物）。
  - **字体层级**：超大中文标题 + 等宽收紧数字（DIN/Bahnschrift）+ 字距拉开的英文小标；按钮改为直角板件，标签改为广播下划线。
- 全部 token 已按 `tests/design-tokens.test.ts` 门槛手算核对：正文/辅助/交互色在 paper/surface/tint 上 ≥4.5:1，字段边框与焦点 ≥3:1。未运行测试。

## 2. 已实施范围（代码已写入）
| 区域 | 文件 | 内容 |
| --- | --- | --- |
| 共享色板 | `src/design/tokens.json` | V3 日场/夜场全套；圆角收紧（14/10/20px）；标题字号上调 |
| 首屏主视觉 | `src/components/v2/ArenaArt.tsx`、`arena.module.css` | 原创矢量竞技场；光束摆动、金色扫描弧、徽面漂浮仅用 CSS transform，减弱动效时停止 |
| 首屏舞台 | `src/components/v2/Stage.tsx`、`stage.module.css` | 移除锥形光/斜纹/网格地板；竞技场 + 胶片颗粒 + 左侧可读性遮罩；广播式 kicker、渐变 em、金色 NEXT UP 条 |
| 客户端特效 | `src/components/v2/StageCanvas.tsx` | 由「粒子连线网」改为跟随光束的尘埃与少量金色余烬；离屏/后台暂停、减弱动效单帧、DPR≤2 保留 |
| 生成资产接口 | `src/components/v2/art.ts` | 服务端检测 `public/visual-v3/*.webp` 是否存在再叠加；缺失不 404、不影响构建 |
| 外壳 | `src/components/v2/Shell.module.css`（追加 V3 块） | 顶栏与手机标签栏在两种主题下都是黑曜 HUD，当前项金色下划线，主 CTA 为清华紫斜切板 + 金边；页脚深靛 |
| 公共组件 | `src/components/v2/ui.module.css`（追加 V3 块） | 内页舞台改为竞技场环纹饰（内联 SVG，CSP 允许 data:）；社群色相版；小标/分区标题金紫竖条；直角按钮；广播下划线标签 |
| 卡片 | `src/components/v2/cards.module.css`（追加 V3 块） | 记分牌日期、广播对阵卡、钢框内容卡；社群无封面兜底改为色相竞技场面板 + 六边形徽面；队徽六边形；荣誉卡金边 |
| 首页 | `src/app/(frontend)/page.tsx`、`home.module.css` | 「关于紫荆」改黑曜立碑面板（可叠加生成材质图）；其余区块随组件更新 |
| 旧斜纹清理 | community/account/team/PageState/PageHeading/AccountPages/ActivityPages/Workspace/QuestionnaireSurface/TeamPages/TeamProfiles/skeleton 模块 | 115° 斜纹与青柠光改为竞技场环纹/光束层与金色 |
| 小程序舞台 | `miniprogram/src/components/zj-stage/index.js` | 竖屏构图的竞技场 Canvas（光束、透视赛台与扫描弧、立碑、悬浮徽面、尘埃、文字遮罩）；约 30fps 上限，隐藏/离屏暂停，无网络 |
| 小程序样式 | `miniprogram/src/templates/v2.wxss`（追加 V3 块）及 home/team/team-home/signup 局部 | 斜切黑曜舞台 + 金色发丝线、内页环纹舞台、记分牌、六边形徽面、广播分段标签、金色进度 |
| 截图入口 | `src/app/(design)/design-preview/visual/page.tsx` | 全合成样张（舞台、对阵卡、社群兜底、招募、公告、内页舞台、社群色相、标签、按钮）；沿用 (design) 的非生产 + 登录门槛，不读 CMS 内容 |
| 测试 | `tests/miniapp-theme.test.ts` | 原生导航/标签颜色期望值改为新 token（断言结构不变） |

业务逻辑、权限、CMS 区块配置、升推、筛选、签名图、webOnly、深链与隐私生命周期代码本轮未改动（仅样式、展示组件与美术）。

## 3. 父助手需运行（顺序）
1. `node scripts/build-design-tokens.mjs --native-config` —— **必需**：重新生成 `src/app/(frontend)/tokens.css`、`miniprogram/src/lib/design-tokens.js`、`app.json` 与各页 JSON 颜色；不运行则 `--check` 失败且颜色仍是 V2。
2. `node scripts/miniapp-icons.mjs` —— **必需**：按新 token 重绘 20 个原生标签图标。
3. （可选）按 `docs/VISUAL_V3_ASSET_BRIEF.md` 生成并放置 `public/visual-v3/arena-hero.webp`、`arena-portrait.webp`、`monolith-detail.webp`；无需改代码（开发服务器需重启以刷新存在检测缓存）。
4. 检查：`node scripts/build-design-tokens.mjs --check --native-config`、`pnpm typecheck`、`pnpm lint`、`git diff --check`、`pnpm vitest run tests/design-tokens.test.ts tests/miniapp-theme.test.ts tests/rebuild-native.test.ts tests/miniapp-wxml-bindings.test.ts tests/miniapp-content-flows.test.ts tests/miniapp-community-flows.test.ts`、`pnpm test`、`pnpm miniapp:check`（主包体积）、`pnpm build`。
5. e2e 重点：`tests/e2e/theme.spec.ts`（顶栏背景期望 `tokens.light.bar`，现为黑曜 rgba）、`rebuild-v2-shell.spec.ts`、`redesign.spec.ts`、`design-refresh.spec.ts`（axe 对比度）、`site.spec.ts`。

## 4. 截图入口与重点（未截图）
- 合成样张：`/design-preview/visual`（非生产 + 合成账号登录）。真实页面在隔离合成库下截：`/`、`/events`、`/events?signupOpen=1`、`/community`、`/community/{合成slug}`、`/teams`、`/teams/recruitment`、`/news`、`/account`、`/login`、`/about`、一个内页任务页（如 `/teams/apply`）。
- 宽度 390 / 768 / 1440；主题日场与夜场（cookie `zijing_theme=dark`）；另截一次 `prefers-reduced-motion: reduce`。
- 重点核对：
  1. 首屏：大标题在竞技场左侧遮罩上的可读性；徽面/立碑在 1440 与 390 的位置（390 下徽面应在右侧可见）；金色是否克制。
  2. 顶部 HUD 与手机标签栏在日场下的黑曜对比；当前项金色下划线。
  3. 内页舞台环纹饰位置（右下）与标题对比；社群色相版。
  4. 无封面社群卡的六边形徽面、对阵卡日期牌、荣誉卡金边。
  5. 日场内容区是否已不再「整页紫」；夜场石墨层级是否分明。
  6. 小程序首页 Canvas 构图（竖屏）、斜切舞台底边与金线、内页环纹、分段标签、日夜两套主题。
  7. axe：日场 `muted`/`action` 在 tint 上、夜场 `action` 文字。

## 5. 首轮作者交接时的未完成 / 风险（后续实际验证以 VISUAL_V3_VALIDATION_20261112.md 为准）
- 视觉、axe、微信开发者工具、真机：**均未验证**。
- 生成资产尚不存在，当前完全由原创矢量/Canvas 呈现；资产到位后需复查叠加强度（`.render` 不透明度 0.78、`lighten` 混合）。
- `detail/feed/layout/work/task/prose` 等模块未逐一重新艺术指导，靠新 token、公共组件覆盖与斜纹清理统一；请按截图指出仍显旧的页面再定点处理。
- 小程序原生 tabBar 日场仍为系统浅色（原生组件限制，颜色随 token 更新）；小程序无系统级「减弱动效」接口，Canvas 以 30fps 上限 + 隐藏/离屏暂停控制功耗。
- `clip-path` 斜切与六边形在小程序 WebView 渲染下需真机确认；`mask-composite: intersect` 仅影响可选生成图的边缘渐隐。
