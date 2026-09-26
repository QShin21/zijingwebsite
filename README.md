# 清华大学学生紫荆电竞社网站

Next.js + Payload CMS + PostgreSQL 模块化单体。公开内容、招新批次、赛季、相册和首页均由中文后台维护。当前运行于本地，未部署生产。完整验收见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)，接手开发先读 [docs/STATUS.md](docs/STATUS.md)。

## 本地启动

要求 Node.js 24.12.0、pnpm 11.19.0。PowerShell 和 Linux 都可运行以下命令：

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm db:dev
```

数据库终端保持运行；另开项目终端：

```sh
pnpm migrate
pnpm dev
```

访问 http://localhost:3000 ，后台 http://localhost:3000/admin 。数据库仅监听 127.0.0.1:55439，数据在 `.data/postgres`。`setup:local` 生成随机秘密且保留已有 `.env`。Windows 使用 PostgreSQL 自带 pg_ctl 的受限进程启动，不建立系统用户。停止数据库：`pnpm db:stop`（Windows）；其他平台在数据库终端按 Ctrl+C。

## 首位管理员

没有默认账号。通过临时环境变量提供自己的邮箱与至少 16 位随机密码。PowerShell：

```powershell
$env:ADMIN_EMAIL = Read-Host '管理员邮箱'
$securePassword = Read-Host '至少16位随机密码' -AsSecureString
$env:ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
pnpm admin:create
Remove-Item Env:ADMIN_PASSWORD
Remove-Item Env:ADMIN_EMAIL
```

已有后台用户时初始化拒绝执行，后续由管理员在后台新增账号。密码不写入仓库或命令参数。首次注册 REST 入口也由服务端限制。没有 SMTP 时密码重置明确失败，不打印重置令牌；管理员可在后台重置其他账号。

## 内容与预览

真实内容尚未提供。首次启动展示空状态。`pnpm seed:demo` 显式导入标注的演示内容，重复执行不重复导入；`pnpm demo:clean` 只删除 `demo=true` 内容，不删除真实记录。两者只允许 development/staging。已发布内容编辑保存草稿，发布负责人审核后点“发布修改”；后台“预览”需登录，禁止公共缓存。

## 实际脚本

| 命令 | 用途 |
|---|---|
| `pnpm typecheck` / `pnpm lint` | 类型与静态检查 |
| `pnpm test` | 时间单元测试、真实数据库权限测试；只准开发库 |
| `pnpm exec playwright install chromium` | 安装浏览器测试环境 |
| `pnpm test:e2e` | 浏览器发布、导航、布局、无障碍；先导入演示 |
| `pnpm build` / `pnpm start` | 生产构建 / 启动构建产物 |
| `pnpm generate:types` | 根据 CMS 模型生成类型 |
| `pnpm payload generate:importmap` | 更新后台组件映射 |
| `pnpm migrate:create` / `pnpm migrate` | 生成可审查迁移 / 执行迁移 |
| `pnpm payload migrate:status` | 查看迁移状态 |
| `pnpm backup` | 数据库与媒体完整备份（需 pg_dump 17+） |
| `pnpm restore:verify <备份目录>` | 新建隔离库恢复、核验所有表和媒体 |
| `pnpm preflight` | 上线缺项检查；不会执行部署 |

`pnpm test` 和浏览器测试会建立并清理虚构测试记录，保留必要审计记录。不要指向生产数据库。容器、反向代理和异机备份说明在 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。
# 账号与社群 V2

网站支持清华邮箱验证码注册、四级角色、社群管理员申请、游戏社群、论坛和全站内容审核。
部署与运营步骤见 [docs/COMMUNITY_V2.md](docs/COMMUNITY_V2.md)。注册需要 SMTP 环境变量；
社长通过指定邮箱的验证码认领，密码只由用户在站内安全输入。普通用户使用唯一昵称或邮箱登录；昵称匹配不区分大小写，显示保留用户输入的大小写。
