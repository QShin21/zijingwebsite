# 项目协作约定

- 本项目的 GitHub 仓库为 https://github.com/QShin21/zijingwebsite，远程名称为 `origin`。
- 后续完成项目修改并通过必要检查后，提交并推送到此仓库；如果用户明确要求暂不提交或推送，遵循当次要求。
- 同步时保留已有修改，避免强制推送；如遇权限或冲突问题，说明实际情况。
- 不要使用“不是……而是……”等句式。
- 部署入口仅使用 `home.thuzijing.top`（紫荆网站）和 `sgs.thuzijing.top`（FreeKill）。已停用的历史域名从配置、脚本、文档和验收记录中移除；历史验收保留原时间及验证范围，并注明入口已隐去。

## V1 工程规则
- 总任务书：`zijing_esports_codex/ZIJING_ESPORTS_CODEX_BRIEF.md`，持续维护 docs/TASKS.md、STATUS.md、DECISIONS.md。
- Next.js + TypeScript + Payload + PostgreSQL 模块化单体；日常内容通过 CMS 管理。
- V1 含公开栏目、三类外部招新、赛季档案、权限、测试、部署和恢复；不开发站内申请、支付、社交。
- 保留既有文件和用户修改；不得编造社团事实；演示数据显式标记且禁止生产导入。
- 公开 Local API 必须 overrideAccess:false、匿名身份、最小字段、禁止草稿和未核验荣誉泄露。
- 服务端执行角色及分部权限；编辑只能保存草稿；生产使用审查后的迁移。
- 秘密、媒体、数据库、备份不得提交；验收依实际执行结果，未运行标为未验证。
- 2026-09-20 用户已明确授权直接管理仓库、修改代码并提交推送。功能改动先在工作分支通过必要检查再更新主分支；不强制推送。购买、DNS、生产部署和破坏性生产操作仍需相应授权。
- 公开站 UI 规则与改版记录见 `docs/UI_REDESIGN.md`；保留原生导航、减少动效、键盘访问和 CMS 配置能力。

## 社团运营改版（2026-10-11 当前授权）

- 本轮用户授权站内社群申请、人工进群及后续运营流程；上方 V1 的“不开发站内申请”为历史范围。需求、建议及阶段边界见 `docs/CLUB_OPERATIONS_DESIGN.md`，不得把建议写成已确认制度。
- 平台角色与社群/队伍任职分别存储；执行部与宣传部同属骨干，不能通过扩大 `canPublish` 获得全局发布和私人报名权限。社群审批不得覆盖平台角色。
- 网站注册、扫描名片、记录意向和批准建群都不代表已进微信群；微信好友、建群和拉群由管理员人工完成。旧聊天、论坛、评论及点赞继续关闭，历史表保留。
- 本阶段唯一源码工作区为本保存环境，所有编码与合成测试均在此进行。禁止读取聊天密码、使用真实私人报名或为 QA 向真人触达。
- 用户已授权最终部署；当前先交付工作分支，独立复核与备份演练后再更新主分支和执行常规可回滚部署。不得猜服务器、读取私钥明文、申请新凭据或拓宽权限。生产不可逆/丢数据迁移需单独停报。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
