# 项目协作约定

## 2026-11-12 · 主分支与当前协作规则

- 用户要求将 `new` 的最新内容合并到 `main`；后续功能修改先在工作分支完成必要检查，再以普通推送更新 `main`，保留已有修改及其他分支。
- 写作和回复使用 `anti-defensive-writing` skill，避免“不是……而是……”等句式。
- 购买、DNS、生产部署和破坏性生产操作仍需相应授权。下文按时间记录的具体任务安排沿用其历史范围，当前任务以用户最新指令为准。

## 原生小程序0.5.0（2026-10-15最新指令）

- 最新发布指令：用户明确“别管后面的验证与测试了，直接部署并上传微信0.5.0”。停止剩余验收，保留原结果和未验证项；直接完成必要构建、文档、普通推送main及紫荆部署。此条覆盖下文等待独立QA/原生核验后才能部署的门槛；只做部署必要的构建和存活检查，不追加测试，不使用GitHub CI。微信由主助手安排Windows官方工具上传开发版，避免重复，不提交正式审核或上线；其他服务保持。
- 用户已将重构后的`new`改名为唯一默认分支`main`；所有后续阶段普通提交推送`origin/main`，不重建`new`或历史分支、不强推。下文旧分支约定保留历史语境，由本条覆盖。
- 后续不使用GitHub CI：不触发、重跑或等待Actions；本仓库workflow已取消push/PR自动触发。后续提交消息带`[skip ci]`，实际测试在执行环境运行并记录日志；跳过CI不能记为通过。不改变组织其他项目、分支保护或安全设置。
- 原生0.5.0按`docs/MINIPROGRAM_0_5_0_DESIGN.md`的A–F推进。A检查点为`b24d14c`，B检查点为`95a4a0d`，C检查点为`be0eede`；Windows独立B复测已通过本地业务与布局检查，官方模拟器截图/点击仍待授权。C/D八页各自实现与本地核验完成（C905项/536布局；D927项/432布局），待独立QA和E阶段官方原生核验；逐阶段验证、提交及回报。保留已完成网站外观、共享暖浅色板/默认浅色/深色及原API、权限、CAS、隐私、16题型和媒体合同。
- E从D检查点`4548d43`整合；使用隔离合成数据库/HTTP、生产构建和浏览器回归。客户端版本统一0.5.0，发布脚本与健康/恢复入口见`docs/MINIPROGRAM_0_5_0_RELEASE_PREPARATION.md`，逐页状态见`docs/MINIPROGRAM_0_5_0_STATE_MATRIX.md`。本地开发证据不替代独立QA与官方原生核验，`releaseReady`保留false表示原清单未全完成；用户最新直接发布指令另行生效，不再以该字段阻止执行或要求确认。
- 继续使用用户指定的`gpt-6-astra max`与按文件划分的并行工作，一个Git整合者；更新进度、普通推main并交付准确SHA。后续遵循最上方停止测试、直接发布指令，不操作FreeKill。

## 完整前端重构（2026-10-13 最新授权）

- 本轮从 `e366f3c6538e6c63c9f13fc183e26c32ce58cf11` 建立唯一开发分支 `new`；实质阶段完成后更新 `docs/FRONTEND_REBUILD_PROGRESS.md`、正常提交并只推送 `new`。下文原 `main` / `littleapp` 开发约定是历史记录，本轮由此条覆盖；保护两个原分支，不强推、不为子任务另建分支。
- 以用户最终《zijing_frontend_rebuild_prompt(1).md》为本轮范围，完成网站与原生小程序的“紫荆主场”完整前端重构。既有 API、身份、对象归属、发布范围和媒体权限保持；匿名社群浏览及骨干招新管理权与任务书的差异先维持源码权限并记录。
- 用户明确授权 `gpt-6-astra max` 与独立领域并行；一个 Git 整合者，按文件划分，公共 tokens / 导航 / 核心表单保持统一。额度截图和阈值不再是本轮阻塞。
- 本轮独立执行所需检查，旧任务停止验收的授权不适用。不部署生产、不发布 CMS、不上传或发布微信；只使用隔离合成测试数据，不读取凭据和真实私人资料。

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
- 2026-09-20 用户已明确授权直接管理仓库、修改代码并提交推送。2026-10-13 用户要求将完整已验证成果同步到原有 `main` / `littleapp` 并清理临时分支；后续提交直接在这两个原分支按适用内容分小步进行，不再新建 topic / codex 分支。保留两分支独有内容，以普通 merge / fast-forward / cherry-pick 同步；不强制推送或改保护设置。分支恢复清单见 `docs/BRANCH_CONSOLIDATION_20261013.md`。购买、DNS、生产部署和破坏性生产操作仍需相应授权。
- 公开站 UI 规则与改版记录见 `docs/UI_REDESIGN.md`；保留原生导航、减少动效、键盘访问和 CMS 配置能力。

## 社团运营改版（2026-10-11 当前授权）

- 本轮用户授权站内社群申请、人工进群及后续运营流程；上方 V1 的“不开发站内申请”为历史范围。需求、建议及阶段边界见 `docs/CLUB_OPERATIONS_DESIGN.md`，不得把建议写成已确认制度。
- 平台角色与社群/队伍任职分别存储；执行部与宣传部同属骨干，不能通过扩大 `canPublish` 获得全局发布和私人报名权限。社群审批不得覆盖平台角色。
- 网站注册、扫描名片、记录意向和批准建群都不代表已进微信群；微信好友、建群和拉群由管理员人工完成。旧聊天、论坛、评论及点赞继续关闭，历史表保留。
- 本阶段唯一源码工作区为本保存环境，所有编码与合成测试均在此进行。禁止读取聊天密码、使用真实私人报名或为 QA 向真人触达。
- 2026-10-13 用户取消后续部署。当前只在原有 `main` / `littleapp` 提交及同步源码；不部署、不发布 CMS、不上传小程序。视觉重设计仍保留为后续工作，未完成样屏必须标注并保留可恢复版本，不能混入已验收功能。不得猜服务器、读取私钥明文、申请新凭据或拓宽权限。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
