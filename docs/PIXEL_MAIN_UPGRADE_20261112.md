# 网页像素校园升级（Opus 阶段）· 2026-11-13

基线：`main@ae6677fc3aafe8c4c72e946b8b8591fc8ea42780`，工作分支 `work/pixel-main-upgrade`。参考 PR #1（`5465ea2`）的像素校园风格与页面布局，按功能重写，没有合并或摘取整个 PR。此阶段只改网页前端；原生小程序、共享设计源 `src/design/tokens.json`、后端业务、数据库结构和迁移均未改动。Fable 阶段将在此基础上加强效果并升级小程序同风格。

## 实现范围

- **四档主题**：清华经典（深葡萄紫·秋夜金）、清凉夏夜（深青·薄荷）、温煦冬日（暖象牙·紫色操作·常青点缀）、简约（系统字体、平面控件、无场景与动效）。沿用 `zijing_theme` Cookie：无偏好与旧值 `light` → 温煦冬日（保持浅色优先），旧值 `dark` → 清华经典。`<html data-z-theme>` 仍是 light/dark 配色方案，原有依赖它的样式与测试继续有效；新增 `data-z-palette` 选择网页配色。主题菜单为按钮展开的四个选项（`aria-expanded`/`aria-pressed`，Esc 和点击外部关闭，焦点回到按钮），切换不重载页面，填写中的表单保留。
- **网页专属配色层** `src/app/(frontend)/pixel.css`：四套完整语义色及像素变量（硬投影、高光、按钮底座、天际线色）；标题使用像素字体，正文保持系统字体；全局 `.button` 与表单输入为像素板件；焦点 3px 方形描边。四套配色的关键对比度由测试校验（正文 ≥4.5:1、边框/焦点 ≥3:1）。
- **全站组件**：在 `Shell`、`ui`、`cards`、`layout`、`home` 样式模块末尾追加像素层，页头天际线、栏目标题、立体按钮（按下下沉 4px）、库存式标签栏、日历牌日期、描边硬投影卡片、社群图标槽位、分页、空状态、页脚天际线随之统一。V3 中写死的黑曜色值已在像素层覆盖。
- **首页**：`CampusHero` 原创像素校园主视觉（CMS 主图优先，标题、副标题、主按钮、焦点活动全部来自 CMS 与原有数据）；下方信息栏放焦点活动或加入指引，以及可暂停的“NEXT UP”近期活动条；CMS 区块保持原有标题、顺序和开关，`data-section` 只在 CMS 区块上，相邻的半宽区块（公告/高光/关于）在桌面配成一行，不改顺序；赛场高光改为轮播，复用原卡片、链接和权限投影，带上一项/下一项/暂停/圆点选择。游戏社群继续来自 CMS 与社群图标配置，未写死游戏列表。
- **动效**：全部在客户端渲染。场景小精灵（星光、路灯、屏幕扫描线、银杏落叶、萤火虫、落雪）为纯 CSS，只在可见且页面在前台时运行；`prefers-reduced-motion` 下停止并隐藏移动元素；简约主题不显示场景。轮播在悬停、聚焦、离屏或后台时停住，减弱动效或简约主题下默认暂停，用户可手动继续；主题切换在支持时使用 8 阶像素擦除过渡。
- **遥测**：按协调者确认，`src/payload.config.ts` 设置官方 `telemetry: false`；所有 Next 命令带 `NEXT_TELEMETRY_DISABLED=1`。不改变权限或业务行为。

## 资产来源与许可

| 资产 | 来源 | 许可/约束 |
|---|---|---|
| `src/components/v2/pixel-art/campus-{classic,summer,winter}.png`、`skyline-mask.png` | `scripts/pixel-campus-art.mjs` 逐像素绘制，种子随机数，输出可复现（`--check` 比对解码像素） | 本项目原创；无照片、真实地标、学校标识、游戏商标或人物；“Z”为站点既有装饰符号。见同目录 `ASSET-PROVENANCE.json` |
| `src/components/v2/fonts/fusion-pixel-12px.woff2` | Fusion Pixel Font 12px（TakWolf），与 PR #1 中文件相同（SHA-256 `4f0ccc75…c301d`） | SIL OFL 1.1，全文 `fonts/OFL.txt`；通过 `next/font/local` 自托管，不预加载 |

未移植 PR #1 的新闻赛事照片、二校门/“清华园”概念画和六个游戏图标。素材经构建输出为带哈希的 `/_next/static/media` 文件，不经过登录代理，访客可加载，适合 CDN 长缓存；未修改 `page-access.ts`。

## 安全与兼容

- 未改：`miniprogram/**`、`src/design/**`、`src/lib/**`（含 `v2/home-sections.ts` 默认标题、`v2/account.ts` 风采审核 `href`/`webOnly`、`page-access.ts`）、`src/collections/**`、`src/migrations/**`。无新依赖、角色规则、schema 或迁移。
- 报名、取消、选座、表单恢复、查询参数等组件逻辑未改；首页登录/访客分支与 main 一致，成员计分板与个人面板保留。
- 非生产样张预览 `visual-direction/theme.ts` 识别新 Cookie 值的明暗（仅预览）。

## 验证（本地隔离合成库，未连接生产）

| 检查 | 结果 |
|---|---|
| `pnpm typecheck` | 通过 |
| 改动文件 ESLint | 通过 |
| 全仓 `pnpm lint` | 仅基线既有 2 项错误（`tests/content-promotions.test.ts:137`），无新增 |
| 定向 Vitest（`pixel-main-upgrade` 10 项、`design-tokens` 5 项、`miniapp-theme` 14 项） | 29/29 通过 |
| 全量 Vitest（新建空合成库） | 2061 项：1768 通过 / 54 失败 / 239 跳过；与基线（2051 项：1844 / 59 / 148）相比无新增失败断言，5 项基线失败本次通过。另有 8 个套件在准备阶段失败（基线中为其他套件），均为“下面的字段是无效的： value”：多个测试夹具创建社长，与 main 迁移 `20261113_000200` 的单社长唯一索引冲突，失败集合随 Vitest 缓存的执行顺序变化；后端代码与基线相同，不计为通过 |
| `node scripts/build-design-tokens.mjs --check --native-config` | 32 项一致 |
| `pnpm miniapp:check` | 29 页 / 199 文件 / 962072 字节，与基线一致 |
| `pnpm build`（webpack） | 通过，BUILD_ID `R2zmHYN_lXRzKMfB75YDG` |
| 生产服务 HTTP 探测 | `/`、`/events`、`/announcements`、`/login` 200；`/community`、`/teams` 对访客仍 307 登录；插画与字体 200；默认 SSR `data-z-theme="light" data-z-palette="winter"`，单个 h1，区块按 CMS 顺序 |

**未完成：真实浏览器视觉与 axe 验收。** 本机 Chromium 启动时进程单例需要创建 Unix 域套接字，被执行环境的网络策略禁止（`socket() failed: Operation not permitted`）；未绕过该限制。截图、四主题实际渲染、390/320 溢出、菜单交互和 axe 需在允许浏览器的环境复核（产物目录 `scripts/visual-qa.mts` 可直接复用）。

## 文件索引

- 主题与外壳：`src/components/v2/theme.ts`、`ThemeToggle.tsx`、`Shell.tsx`、`Shell.module.css`、`pixel-font.ts`、`Icon.tsx`（新增暂停图标）、`src/app/(frontend)/layout.tsx`、`src/app/(design)/layout.tsx`
- 配色层：`src/app/(frontend)/pixel.css`
- 首页：`src/app/(frontend)/page.tsx`、`home.module.css`、`src/components/v2/CampusHero.tsx`、`CampusMotion.tsx`、`campus.module.css`、`home-layout.ts`
- 共享组件样式：`src/components/v2/ui.module.css`、`cards.module.css`、`layout.module.css`
- 素材：`scripts/pixel-campus-art.mjs`、`src/components/v2/pixel-art/*`、`src/components/v2/fonts/*`
- 测试：`tests/pixel-main-upgrade.test.ts`
- 其他：`src/payload.config.ts`（`telemetry: false`）、`src/components/visual-direction/theme.ts`

## Fable 接力要点

1. 先在允许浏览器的环境运行视觉验收（四主题 × 1440/768/390/320、访客与成员、减弱动效、axe），修正截图暴露的问题。
2. 加强效果可在 `CampusHero` 的 `Ambience` 内扩展：精灵坐标以 480×200 原画像素为单位（`at(x, y)`），场景框按原画比例右下锚定，坐标在各种裁切下保持对齐；新动画沿用 `data-motion` 门控、`prefers-reduced-motion` 与简约主题关闭规则。可考虑 Canvas/WebGL 层，但应保持静态 PNG 作为首屏与无 JS 回退。
3. 插画修改请改 `scripts/pixel-campus-art.mjs` 后重新生成并通过 `--check`；新增素材继续登记 `ASSET-PROVENANCE.json`，不引入照片、商标、学校标识或人物。
4. 小程序同风格：配色以 `pixel.css` 四套语义色为准；小程序共享的 `src/design/tokens.json` 会同时影响网页 `tokens.css` 与小程序生成文件，需同步运行 `build-design-tokens.mjs --native-config` 与 `miniapp-icons.mjs`，并保持旧版小程序兼容。
5. 字体约 694 KB，按需懒加载并长缓存；若环境提供 brotli/fonttools，可按 `unicode-range` 拆分子集以减少首访流量。
6. 静态资源均为带哈希的构建产物，适合 CDN；首页仍为 `force-dynamic`，若要进一步降低服务器负载，需另行评估缓存与登录态边界，不应把成员内容放入公共缓存。
