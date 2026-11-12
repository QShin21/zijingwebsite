# zijingwebsite 项目说明

@AGENTS.md

## 项目与入口

清华大学学生紫荆电竞社网站，采用 Next.js、React、TypeScript、Payload CMS 与 PostgreSQL 的模块化单体架构。仓库还包含原生微信小程序。

接手工作先读 `docs/STATUS.md`；项目协作约定见上方导入的 `AGENTS.md`。历史发布与部署记录仅作为背景，按用户当前任务确定执行范围。

- `src/`：网站与 CMS 源码。
- `miniprogram/`：原生小程序。
- `scripts/`：本地开发、数据库及发布辅助脚本。
- `tests/`：测试。
- `docs/`：状态、设计、权限、部署及验收资料。

## 本地开发

README 推荐 Node.js 24.12.0、pnpm 11.19.0；`package.json` 的 Node 最低版本为 22.13.0。

1. `pnpm install --frozen-lockfile`
2. `pnpm setup:local`
3. `pnpm db:dev`（数据库终端保持运行）
4. 另开终端执行 `pnpm migrate`，再执行 `pnpm dev`。

本地网站为 `http://localhost:3000`，CMS 后台为 `/admin`。数据库与环境配置细节见 README。不要将本地操作指向生产数据库。

## 验证命令

- `pnpm typecheck`：TypeScript 检查。
- `pnpm lint`：静态检查。
- `pnpm test`：Vitest 测试，涉及数据库时仅使用隔离开发/测试数据。
- `pnpm test:e2e`：Playwright 浏览器测试，先按 README 准备测试环境。
- `pnpm miniapp:check`：小程序检查。
- `pnpm build`：生产构建，不等于部署。

根据实际改动选择检查，并明确区分已通过、失败、未运行的检查。本文创建时未安装项目依赖或执行上述项目测试。

## 安全与范围

- 保留用户修改，不强制覆盖或强推。
- 不把秘密、凭据、媒体、数据库或备份提交到仓库；不要读取真实私人报名资料用于测试。
- 保留服务端角色、分部、对象归属和发布范围的权限边界，公开 Local API 的访问约束按 AGENTS.md 执行。
- 初始化项目说明不授权推送、部署、发布 CMS、上传或发布微信小程序；这些动作须符合用户当前明确授权。
- 后续调用 Claude Code 时，按具体任务提供所需工具许可；不要为方便而启用全局权限绕过。
