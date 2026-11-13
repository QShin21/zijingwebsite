# 双端像素校园（Fable 阶段）· 2026-11-13

在 Opus 阶段网页像素校园（见 [PIXEL_MAIN_UPGRADE_20261112.md](PIXEL_MAIN_UPGRADE_20261112.md)）之上继续：加强网页景深与像素光效，并把原生小程序升级为同一风格。基线 `main@ae6677f`，工作树 `work/pixel-main-upgrade`，未合并 PR #1。未提交、推送、部署，未上传微信。后端业务、权限、API、CMS 合同、数据库结构与迁移未改动。

## 实现

### 网页
- **景深**：`MotionScene` 在可见、精细指针、未开启减弱动效且非简约主题时监听指针，每帧最多写一次 `--mx/--my`；CSS 让场景、远景（星星、流星、云）和近景（闪光、落叶、萤火虫）按不同幅度位移。
- **像素光效**：流星（夜景）、飘云（冬日）、近景闪光、标题强调词阶梯光扫、场景淡扫描线；按钮悬停/聚焦一次性高光扫过；卡片悬停/聚焦底边强调色；社群图标槽位悬停抬起。
- **滚动显现**：栏目与主视觉信息栏使用 `animation-timeline: view()`，无脚本；不支持的浏览器直接显示。
- 所有新动效沿用 `data-motion` 门控、`prefers-reduced-motion` 关闭和简约主题关闭规则；不影响表单、筛选、报名、选座逻辑。

### 原生小程序
- **共享配色**：`src/design/tokens.json` 的 `light` 改为温煦冬日、`dark` 改为清华经典（与网页 `pixel.css` 同值，有测试比对）。小程序舞台在两种模式下都保持深葡萄紫，保证舞台上的浅色文字可读。已有 `zijing_theme` 本地偏好（light/dark）继续有效。重新生成 `tokens.css`、`design-tokens.js`、`app.json` 与各页 JSON 颜色、20 个标签图标。
- **首页舞台** `components/zj-stage`：Canvas 2D 在设备上按粗像素网格绘制原创夜间校园（教学楼、钟楼、电竞馆对战屏、路灯、树），浅色偏好为雪夜落雪，深色偏好为秋夜落叶；约 12 fps，页面隐藏或离屏暂停，无网络请求，触摸有像素火花。Canvas 不可用时保留静态舞台。
- **样式层**：`app.wxss` 与 `templates/v2.wxss` 末尾追加像素层：方角描边按钮（按下下沉）、硬投影面板与卡片、内凹输入框、日历牌日期、库存式分段标签、像素栏目标记、色相社群封面。`pages/auth/index.wxss` 仅追加方角，注册邮箱两行布局保持（有测试断言）。
- 未改任何 WXML、页面 JS、路由、接口调用和 `config.js` 版本号（仍为 0.5.18；上传前由发布方决定版本）。包体 970236 字节（此前 962072），无新增图片或字体。

## 资产与许可
- 未新增图片或字体。网页插画仍由 `scripts/pixel-campus-art.mjs` 生成（`--check` 通过）；小程序场景由 `zj-stage/index.js` 代码绘制。均为原创，无照片、真实地标、学校标识、游戏商标或人物；“Z”为站点既有装饰符号。
- 字体仍为 Fusion Pixel 12px（SIL OFL 1.1，`src/components/v2/fonts/OFL.txt`），仅网页按需加载；小程序不带字体包。

## 静态/动态分离与 CDN 边界
- 插画、遮罩、字体、CSS、JS 为带内容哈希的 `/_next/static/**`，可由 CDN 长缓存。
- 动效全部在浏览器或小程序端运行：无服务端渲染动效、无轮询、无新增数据库查询或接口、无外部跟踪。
- HTML 与 API 响应的缓存策略未改：页面仍 `force-dynamic`，私有 API 与登录后 HTML 仍为 `private, no-store`，不应放入公共缓存。

## 验证（本地，隔离合成数据）
| 检查 | 结果 |
|---|---|
| `pnpm typecheck` | 通过 |
| 改动文件 ESLint | 通过 |
| 定向 Vitest 7 个文件 145 项 | 139 通过、6 失败；6 项均在基线失败清单内（`miniapp-community-flows` 5 项旧进群用例、`rebuild-native` 1 项选座输入框 `cursor-spacing`），无新增 |
| `tests/pixel-main-upgrade.test.ts` | 12 项通过（含双端配色一致、舞台无请求、邮箱两行保持） |
| `build-design-tokens.mjs --check --native-config` | 32 项一致 |
| `pixel-campus-art.mjs --check` | 4 项一致 |
| `pnpm miniapp:check` | 29 页 / 199 文件 / 970236 字节 |
| `pnpm build` | 通过，BUILD_ID `SouY9p52JgE6H2NYdUaVK` |

**未验证**：真实浏览器渲染、交互与 axe（执行环境禁止 Chromium 所需的 Unix 套接字，未绕过）；微信开发者工具编译与真机。全量 Vitest 本阶段未重跑；Opus 阶段结果及基线 54 项既有失败见升级说明，不能称全绿。可在正常环境运行产物目录 `scripts/visual-qa.mts` 复核网页；小程序需在微信开发者工具中查看首页舞台、按钮、卡片、注册页与选座页，重点看浅色模式下各页写死的圆角或深色渐变是否仍有残留。

## 文件索引
- 网页：`src/components/v2/CampusMotion.tsx`（指针景深）、`CampusHero.tsx`（流星、云、闪光）、`campus.module.css`、`ui.module.css`、`cards.module.css`（末尾 Fable 块）
- 共享：`src/design/tokens.json` 及生成物 `src/app/(frontend)/tokens.css`、`miniprogram/src/lib/design-tokens.js`、`miniprogram/src/app.json`、各页 `*.json`、`miniprogram/src/assets/*.png`
- 小程序：`miniprogram/src/components/zj-stage/index.js`、`app.wxss`、`templates/v2.wxss`、`pages/auth/index.wxss`
- 测试：`tests/pixel-main-upgrade.test.ts`、`tests/miniapp-theme.test.ts`（颜色期望值随 tokens 更新）

## 协调复核与独立静态视觉验收（2026-11-13）
- 独立复跑像素升级与小程序主题两个测试文件：26/26 通过；小程序结构、tokens 与原创插画生成物检查通过。随后移动筛选单点修复新增一项用例，像素升级测试为 13/13，类型检查、变更文件 lint 和最终生产构建再次通过。
- 最终构建 `yTSqDkK1MVgqdp_5cltDv`。以隔离合成数据通过真实 HTTP/JWT 导出访客与成员共 28 个页面主题快照，静态解析 Next 流式边界后供 Firefox 实渲染。导出器曾遗漏嵌套占位，已修复验收产物；这不构成站点运行故障的证据。
- 实际看图范围：访客首页 winter/classic 桌面 1440 与移动 390，成员首页 winter 移动 390；日程、社群、代表队的关键浅深色桌面/移动页面。首页、社群、队伍未见阻断性溢出或遮挡。
- 日程 390px 的时间筛选栏曾被裁切，已由 Fable 将手机断点控件改为整行，桌面和筛选逻辑不变。最终 classic 与 winter 390px 均已真实复验，时间/月/类型下拉箭头完整，原裁切关闭。
- 静态审阅范围可以交付。没有逐图覆盖全部 28 页，不代表 JS 交互、axe 或微信开发者工具/真机验收通过。既有全量测试失败仍按前文披露。合成演示日期为 2099，不代表生产活动日期。
- 后端 `src/lib`、集合、迁移保持基线不变；不部署、不上传或发布小程序，不删除旧 PR 源分支。最终源码发布以 Git 提交为准。
