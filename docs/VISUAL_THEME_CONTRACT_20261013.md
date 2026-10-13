# 浅色默认与双主题整合契约 · 2026-10-13

用户最新要求覆盖此前只做深墨舞台的展示方向。完整浅色方案为首次及无有效个人偏好时的默认，系统深色不改变默认。保留深色方案与显式切换，记住本人选择。尚在开发，本文是三个并行模块的增量接口，不代表双主题已验收。

## 网页接口

- 根 HTML：`data-z-theme="light"` 或 `data-z-theme="dark"`。不按系统 `prefers-color-scheme` 选择主题。
- 唯一持久化键：cookie `zijing_theme`，仅接受精确 `light` / `dark`；缺失或非法值一律 `light`。Path=/，SameSite=Lax，Max-Age=31536000；HTTPS 加 Secure。仅存显示偏好，无会员数据。
- 根任务在两个根 layout 中以服务端 cookie 初始化 HTML 和切换组件，同一初始值用于 hydration。首次页面直接发送浅色 CSS / 属性，不用先绘深色再 effect 改色的方案。
- 切换后同步 HTML 属性、组件状态和 cookie。页面跳转及再次打开保持选择。根任务负责导航中的主题按钮与公共样式，各模块不另造存储或初始化脚本。
- 局部 CSS 使用以下语义变量，移除固定深色的输入、错误、标签、表单和遮罩颜色；正文、焦点、禁用、空态和图片遮罩需分别检查。基础字体、尺寸、布局及原业务门禁保持。

| 变量 | 默认 light | dark |
|---|---|---|
| `--z-paper` | #f4f1ea | #131217 |
| `--z-surface` | #fffdf8 | #1c1922 |
| `--z-ink` | #211e27 | #f3eef7 |
| `--z-muted` | #625c68 | #bfb5cc |
| `--z-purple` / `--z-action` | #6839ae | #c6a5ef |
| `--z-action-ink` | #fffdf8 | #22152f |
| `--z-hover` | #552995 | #dbc2f6 |
| `--z-line` | #d9d3dc | #4b4058 |
| `--z-tint` | #eee7f4 | #292135 |
| `--z-field` | #fffefa | #17141d |
| `--z-field-border` | #bcb3c5 | #685a78 |
| `--z-danger` | #963447 | #ffbac6 |
| `--z-danger-bg` | #f9e9ec | #321d27 |
| `--z-danger-line` | #d9a3ae | #8b5162 |
| `--z-focus` | #6839ae | #edb353 |
| `--z-disabled-bg` | #e5dfea | #38323f |
| `--z-disabled-ink` | #6f6479 | #b8a9c5 |
| `--z-header-bg` / `--z-footer-bg` | #fffdf8 | #17151c |
| `--z-header-ink` / `--z-footer-ink` | #211e27 | #f3eef7 |
| `--z-stage-bg` | #ece7df | #17151c |
| `--z-stage-ink` | #211e27 | #fffdf8 |
| `--z-stage-muted` | #625c68 | #bdb6c7 |
| `--z-stage-action` | #6839ae | #c6a5ef |
| `--z-stage-action-ink` | #fffdf8 | #22152f |

`--z-dark #17151c`、`--z-lilac #c6a5ef`、`--z-amber #edb353` 为固定颜料色；不能把 `--z-dark` 当作随主题变化的页面/输入背景。阶段舞台改用 `--z-stage-*`，浅色使用原创浅场景素材，旧深色素材保留。原公共 gutter/max/sans/mono/radius 接口不变。切片可以在局部设置别名：如 `--club-bg:var(--z-paper)`、`--club-accent:var(--z-action)`；按钮字色必须搭配 `--z-action-ink`。

## 原生接口（由原生任务实现）

微信本地偏好键同名 `zijing_theme`，合法值 light/dark，缺省及非法值默认 light，不依赖系统主题。页面最外层采用 `theme-light` / `theme-dark` 作用域，由原生任务统一初始化、切换、保存、页面展示与导航栏/tabBar 配色；首屏 window 默认浅色。按上表语义和两套实际颜色映射 WXSS，保持现有深色版本可切换。若运行时不能直接使用 CSS 变量，使用等价作用域声明。

原生任务只交增量补丁，不推送；保留隐私授权、WX 生命周期函数和过期响应门禁。图像保持两个原创版本，不对真实公开照片做颜色反转。官方工具/真机与映射浏览器结果分别报告。

## 增量与验收

三切片原输入已应用，最新原生检查点为 `43e1a6fca77be7d6f4b0f9272b0edc91fbf09b8d`。网页切片和公共布局当前在唯一整合工作区；各任务以自己的已交付补丁后状态作增量，并核对原生根任务暖纸调整。活动任务只改活动局部组件/样式；社群任务只改 `_club` 及其页面；原生任务只改 miniprogram。根任务统一冲突及共享变量、布局、素材、切换与远端写入。

真实验证必须包括：系统 dark + 无 cookie 仍先浅色；首次 SSR 属性与背景浅色；显式深/浅切换；刷新/跨路径/重新打开保存选择；非法偏好回浅色；无 JS 的默认浅色和原生导航；两主题正文、焦点、表单错误、禁用、空态及图片实际截图；无 hydration mismatch。不得以单色反转或旧深色截图代替浅色验收。

仅提交同步原 main/littleapp，不部署、不发布 CMS、不上传微信，不读取凭据或使用真实成员数据。
