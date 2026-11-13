# 网页客户端特效 · 2026-11-13

基线 `main@54ddcc2`，原开发分支 `work/web-effects-20261113`。改动范围为网页前端展示层；小程序、共享 tokens、API、权限、迁移、数据均为零改动。地标插画及其来源记录（见 [首页插画与邮箱身份](CAMPUS_ART_AND_ACCESS_20261113.md)）保持不变，未新增图片、字体或依赖。应用 `0ede7dc` 已于 2026-11-13 18:59:30 部署，详见[发布记录](evidence/web-client-effects-deployment-20261113.json)。

## 粒子和点击效果增强

应用 `8b0a96b` 于 2026-11-13 19:13:24 部署。三套动效主题增加粒子数量、尺寸、亮度和部分移动速度；地标光晕与鼠标跟随光增强。点击或触碰首页画面时出现扩散的虚线光环与更明显的火花，单次火花持续约 1.35 秒。为控制连续点击带来的开销，画布粒子总数上限为 260，最多同时保留 4 个点击光环。候选四主题、移动模拟、点击和减少动画检查及公网点击验证通过；真实手机未检查。详见[发布记录](evidence/atmosphere-visibility-deployment-20261113.json)。

## 设计选择

1. **首页氛围画布**（`AtmosphereCanvas`）：主视觉上叠一层 2D Canvas，按主题绘制有纵深的像素粒子。清华经典是上升的金色微尘和斜飘的银杏叶，清凉夏夜是带拖尾的萤火虫，温煦冬日是随风的雪。鼠标带出灯笼光并推开附近粒子，横向移动会带起风；点击或轻触释放扩散光环和火花。
2. **地标光晕**：地标周围一层随主题取色的暖光缓慢呼吸，位于粒子之下、文字遮罩之上。
3. **滚动景深**：主视觉滚出视口时，地标下沉得比文案慢，文案上浮并淡出；卡片进入视口时逐张升起。使用 CSS `animation-timeline: view()`，不执行脚本。
4. **卡片指针光**（`ClientEffects`）：鼠标所在的卡片上出现跟随的强调色柔光，突出当前可点对象。
5. **阅读进度与顶栏层次**：顶栏底边的渐变进度条随页面滚动增长，滚动后顶栏投影加深。使用 CSS `animation-timeline: scroll()`。

这些效果都是装饰层：`pointer-events: none`、`aria-hidden`，不覆盖按钮、表单和链接，不改变 DOM 顺序与文案。

## 动效策略

| 情形 | 行为 |
|---|---|
| `prefers-reduced-motion: reduce` | 画布不启动；光晕呼吸、景深、卡片入场、指针光关闭；静态光晕与进度条保留 |
| 简约主题 | 画布、光晕、指针光、卡片入场关闭 |
| 离屏 / 后台标签页 | 画布停止并清空（IntersectionObserver + visibilitychange） |
| 触屏 | 无指针光与灯笼光；粒子数约为桌面的 55%，约 30 fps；轻触有火花；≤759px 关闭滚动景深 |
| 不支持滚动时间线的浏览器 | 直接显示，无入场与进度条 |

画布像素比上限 1.5，粒子总数上限 260。

## 客户端 / 服务器边界

- 新增的两个组件都是 `"use client"`，不读数据、不发请求、不用定时轮询；服务端只多输出一个空 `<canvas>` 和一个空 `<span>`。
- 没有新增接口、数据库查询、服务端渲染逻辑或缓存设置。页面仍为 `force-dynamic`，本地实测首页、日程、登录页响应头为 `private, no-cache, no-store`。
- JS 与 CSS 进入带哈希的 `/_next/static/**`，可由 CDN 长缓存。无外部脚本或跟踪。

## 文件索引

- `src/components/v2/AtmosphereCanvas.tsx`：氛围画布（新）
- `src/components/v2/atmosphere-particles.ts`：粒子去留判定（新；火花按 `burst` 标识到期即移除）
- `src/components/v2/ClientEffects.tsx`：卡片指针光的全局监听（新）
- `src/components/v2/CampusHero.tsx`：挂载光晕与画布
- `src/app/(frontend)/layout.tsx`：挂载 `ClientEffects`
- `src/components/v2/campus.module.css`、`cards.module.css`、`Shell.module.css`：末尾“客户端特效”块
- `tests/web-client-effects.test.ts`：契约与粒子去留测试（新）
- `tests/web-atmosphere-canvas.test.ts`：画布 effect 行为测试（新）

## 验证（本地，新建隔离合成库）

| 检查 | 结果 |
|---|---|
| `pnpm typecheck` | 通过 |
| 改动文件 ESLint | 通过 |
| 定向 Vitest 6 个文件 47 项 | 46 通过、1 失败；失败项 `web-team-ui-details`「team profile cards on a phone」在改动前同样失败（基线 43 项中 42 通过） |
| `tests/web-client-effects.test.ts` | 7 项通过（含火花生命周期回归：寿命跨过 0 后必须移除） |
| 迁移 + `pnpm build` | 通过，火花修复后重新构建通过 |
| 本地生产服务 SSR | 四主题首页、日程、登录页 200；首页含 1 个 h1 和 1 个画布；`/community`、`/teams` 访客 307，`/api/teams` 401 |
| 受保护路径 diff | `miniprogram`、`src/lib`、`src/collections`、`src/migrations`、`src/design`、`src/access`、`src/proxy.ts` 为 0 行 |

| `tests/web-atmosphere-canvas.test.ts` | 2 项通过：以桩替换 canvas、requestAnimationFrame、IntersectionObserver、visibility 和 reduced-motion，执行真实 effect，覆盖启动、绘制、火花到期移除、离屏/后台暂停、减弱动效与简约不启动、清理 |

## 首次提交时的视觉验收限制

首次提交时，动态效果尚未在真实浏览器中查看：

- 实现环境中 Chromium 无法启动（进程单例需要的 Unix 套接字被执行环境禁止）。
- 协调者的云浏览器访问本机回环地址返回 `ERR_CONNECTION_REFUSED`（执行网络隔离）。
- 独立 Firefox 因后台 Mozilla remote-settings 网络受限，没有产出新截图。

首次提交前的行为测试覆盖 effect 的启动、暂停、清理逻辑和绘制调用；当时未运行全量测试、e2e 与 axe。合成 SSR 导出（修复火花前的构建，页面结构相同）位于产物目录 `ssr/`。

## 部署前后的浏览器检查

部署前通过服务器候选端口和 Chromium 查看四主题首页、公告页及 390 像素移动模拟首页。三套动效主题的画布有实际绘制，简约主题与减弱动效设置下画布停止；指针光、滚动进度和离屏清空检查通过。部署后，公网首页在 Chromium 显示冬日主题且画布正常绘制，页面未报告 JavaScript 异常。移动检查使用浏览器模拟；实际手机触控、帧率及登录态业务流程未检查。
