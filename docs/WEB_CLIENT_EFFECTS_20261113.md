# 网页客户端特效 · 2026-11-13

基线 `main@54ddcc2`，分支 `work/web-effects-20261113`。只改网页前端展示层；小程序、共享 tokens、API、权限、迁移、数据均为零改动。地标插画及其来源记录（见 [首页插画与邮箱身份](CAMPUS_ART_AND_ACCESS_20261113.md)）保持不变，未新增图片、字体或依赖。未部署。

## 设计选择

1. **首页氛围画布**（`AtmosphereCanvas`）：主视觉上叠一层 2D Canvas，按主题绘制有纵深的像素粒子。清华经典是上升的金色微尘和斜飘的银杏叶，清凉夏夜是带拖尾的萤火虫，温煦冬日是随风的雪。鼠标带出一团柔和的灯笼光并推开附近粒子，横向移动会带起风；点击或轻触释放一小簇火花。
2. **地标光晕**：地标周围一层随主题取色的暖光缓慢呼吸，位于粒子之下、文字遮罩之上。
3. **滚动景深**：主视觉滚出视口时，地标下沉得比文案慢，文案上浮并淡出；卡片进入视口时逐张升起。使用 CSS `animation-timeline: view()`，不执行脚本。
4. **卡片指针光**（`ClientEffects`）：鼠标所在的卡片上出现跟随的强调色柔光，突出当前可点对象。
5. **阅读进度与顶栏层次**：顶栏底边的渐变进度条随页面滚动增长，滚动后顶栏投影加深。使用 CSS `animation-timeline: scroll()`。

这些效果都是装饰层：`pointer-events: none`、`aria-hidden`，不覆盖按钮、表单和链接，不改变 DOM 顺序与文案。

## 动效策略

| 情形 | 行为 |
|---|---|
| `prefers-reduced-motion: reduce` | 画布不启动；光晕、景深、卡片入场、指针光全部关闭；进度条保留（随滚动的位置指示） |
| 简约主题 | 画布、光晕、指针光、卡片入场关闭 |
| 离屏 / 后台标签页 | 画布停止并清空（IntersectionObserver + visibilitychange） |
| 触屏 | 无指针光与灯笼光；粒子数约为桌面的 55%，约 30 fps；轻触有火花；≤759px 关闭滚动景深 |
| 不支持滚动时间线的浏览器 | 直接显示，无入场与进度条 |

画布像素比上限 1.5，粒子上限约 220。

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

## 未完成的视觉验收

动态效果没有任何一次在真实浏览器里被看到，不能称视觉验收通过：

- 实现环境中 Chromium 无法启动（进程单例需要的 Unix 套接字被执行环境禁止）。
- 协调者的云浏览器访问本机回环地址返回 `ERR_CONNECTION_REFUSED`（执行网络隔离）。
- 独立 Firefox 因后台 Mozilla remote-settings 网络受限，没有产出新截图。

以上限制均未绕过，也没有更改安全设置。因此 Canvas 粒子观感与帧率、指针光、滚动时间线的实际表现、各主题下文字可读性、触屏交互都未验证；行为测试只证明 effect 的启动、暂停、清理逻辑和绘制调用不出错。另外未跑全量测试、e2e 与 axe。合成 SSR 导出（修复火花前的构建，页面结构相同）在产物目录 `ssr/`。上线前应在可用浏览器中实际查看四个主题的首页与一个列表页。
