# 清华大学学生紫荆电竞社网站

基于 Next.js、Payload CMS 和 PostgreSQL 的社团网站，提供活动日程与报名、游戏社群、代表队选拔、骨干招新、公告影像和个人工作台。内容与业务配置由中文后台维护。

本分支将像素校园设计接入正式网页。原生小程序继续使用原有界面；网页改版说明见 [PIXEL_CAMPUS_WEB.md](docs/PIXEL_CAMPUS_WEB.md)。部署记录见 [STATUS.md](docs/STATUS.md)，日常运营流程见 [CLUB_OPERATIONS.md](docs/CLUB_OPERATIONS.md)。

## 本地运行

需要 Node.js 24.12.0 和 pnpm 11.19.0。在项目根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm db:dev
```

保留数据库终端，另开终端执行：

```sh
pnpm migrate
pnpm dev
```

- 网页：<http://localhost:3000>
- 管理后台：<http://localhost:3000/admin>
- 本地数据库：`127.0.0.1:55439`，数据目录 `.data/postgres`

`setup:local` 在没有 `.env` 时生成本地配置和随机密钥，已有配置会保留。数据库启动脚本支持 macOS、Linux 和 Windows；Windows 使用 PostgreSQL 自带的受限进程，不创建系统用户。停止数据库：Windows 执行 `pnpm db:stop`，其他平台在数据库终端按 Ctrl+C。

查看生产构建效果：

```sh
pnpm build
pnpm start
```

## 网页改版

- **清华经典**：紫色校园、暖金主操作与秋日二校门，首次访问默认使用。
- **清凉夏夜**：深蓝绿、薄荷色与夏日校门。
- **温煦冬日**：暖白、深绿与雪景校门。
- **简约**：系统字体、平面控件，减少装饰和环境动画。

主题通过 `zijing_theme` Cookie 保存，兼容旧版深浅主题。切换不重置填写中的表单。

登录首页按工作台／近期日程、焦点活动／正在招募、公告／赛场高光分组，游戏社群位于下方。访客保留独立的浏览与参与入口。日历分别标记未来活动、本人已报名活动与今天；历史日期仍可查询。

按钮按用途采用台阶切角、票券缺口、菜单页签和方向键，选中、按下、键盘焦点与禁用状态保持明确。消息和照片支持手动切换；鼠标停留、键盘聚焦、离开视口、页面隐藏、减少动态或简约主题时停止自动切换。

## 预览内容与账号

新数据库默认展示空状态。需要示例内容时执行：

```sh
pnpm seed:demo
```

像素改版另有更完整的本地预览资料。在 `.env` 设置 `APP_ENV=development`，使用本机数据库并保持 SMTP、S3 未配置后执行：

```sh
PIXEL_PREVIEW_SEED=1 pnpm exec tsx scripts/pixel-preview-seed.ts
```

PowerShell 可先设置 `$env:PIXEL_PREVIEW_SEED = '1'`，再运行 `pnpm exec tsx scripts/pixel-preview-seed.ts`，完成后删除该环境变量。

脚本补充标记为演示的公告、活动与相册，重复运行不重复导入，演示活动不接受实际报名。`pnpm demo:clean` 清理 `demo=true` 内容，保留正式记录。

网站没有默认账号。正常注册需要清华邮箱及 SMTP；登录支持唯一昵称或邮箱。首位后台管理员可通过 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 临时环境变量运行 `pnpm admin:create` 创建；建议使用至少 16 位密码，通过安全交互输入，完成后清除环境变量。已有后台用户时初始化会拒绝执行。

登录后界面的合成记录脚本为 `scripts/pixel-preview-account-seed.ts`：仅接受本机 55439 端口、`APP_ENV=development`、未配置 SMTP/S3 的数据库，以及预先创建、仅有 `member` 角色的专用体验账号。它不创建账号或授予权限；具体约束见 [改版记录](docs/PIXEL_CAMPUS_WEB.md)。

## 目录导航

- `src/app/(frontend)/`：网页路由、首页与主题覆盖样式。
- `src/components/v2/`：导航、校园封面、按钮、卡片、日历和轮播。
- `src/components/activity-pages/`：活动详情、报名与座位界面。
- `src/lib/`：业务规则、权限和页面数据读取。
- `src/collections/`、`src/migrations/`：CMS 模型与数据库迁移。
- `public/pixel-campus/`：像素校园、字体与游戏图标。
- `scripts/`：本地环境、演示资料和运维工具。
- `tests/`：单元、集成与浏览器回归。
- `miniprogram/`：原生微信小程序。

## 检查与测试

```sh
pnpm typecheck
pnpm lint
pnpm build
```

像素网页、日历与本轮审核修复的定向回归：

```sh
pnpm exec vitest run tests/pixel-campus.test.ts tests/pixel-campus-render.test.ts tests/v2-calendar.test.ts tests/pixel-audit-followups.test.ts tests/rebuild-activity-feedback.test.ts
```

完整测试使用 `pnpm test`。部分集成和浏览器测试会写入、清理合成记录，应使用独立开发数据库。浏览器环境安装与运行：

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

本地已执行的检查、覆盖范围与未完成项见 [改版验证记录](docs/PIXEL_CAMPUS_WEB.md)。

## 素材与维护

素材来源和处理方式记录在 [ASSET-PROVENANCE.json](public/pixel-campus/ASSET-PROVENANCE.json)，游戏图标来源见 [SOURCES.json](public/pixel-campus/game-icons/SOURCES.json)，像素字体附 [SIL OFL 许可](public/pixel-campus/FONT-LICENSE.txt)。校门概念插画保留 AI 标识，赛事示例照片保留原水印和来源；CMS 主图与已发布内容优先。

原有报名、申请、人工进群、CMS 发布和服务端授权继续使用。注册或提交意向不会自动进入微信群，拉群由管理员完成。隐私与运营说明见 [COMMUNITY_V2.md](docs/COMMUNITY_V2.md) 和 [CLUB_OPERATIONS.md](docs/CLUB_OPERATIONS.md)。备份、恢复及部署工具见 [DEPLOYMENT.md](docs/DEPLOYMENT.md)。
