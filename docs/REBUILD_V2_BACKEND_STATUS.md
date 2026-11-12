# V2 后端实施状态

2026-11-11。产品/接口由 Claude Code Opus 5.5 max 定义，后端由 GPT-6.1 Sol max 实现。当前位于 `new`，未提交、未推送、未部署。

## 交付

- M1：共享 types、session/home/calendar/event/recruitment/pages、版本图片、访客首页规则已实现。
- M2：动态、社群、社群通知/活动/风采、队伍/公开简介/荣誉、本人工作台/报名/申请、授权审核队列已实现。
- M3：临时图片上传、风采投稿、风采审核及原 action 共用事务服务、社群活动日程 CAS 编辑已实现。
- `/api/v2/[...path]` GET/POST 总路由、`src/lib/v2/index.ts` 均已落地。
- PendingUploads 与社群日程字段、生成类型及 additive 迁移已落地；旧结构不删除。

## 安全与兼容

- 公开查询使用匿名身份、`overrideAccess:false`、`draft:false` 与最小 select；私人资料限本人和既有授权对象。
- 账号身份重新从数据库读取；Cookie/JWT/Origin、权限与修订冲突由服务端验证。
- 图片不返回 data URL；授权在 304 前执行；请求体有流式上限。
- 新日程变更绑定升推复审；隐藏或生产 demo 父社群不进入社群聚合。
- 混合测试服务端断言已独立复制为六个 `v2-legacy-*` 文件。它们不读取前端/小程序实现，供客户端重写时继续保留路由/鉴权/CAS/问卷覆盖。

## 验证进展

已实际通过真实合成 PostgreSQL 迁移，以及服务/HTTP/权限/上传/图片/日程与保留服务检查。最终退出码和计数以 `docs/evidence/rebuild-v2-backend-validation-20261111.json` 为准。所有角色在数据库读取后重新判断；测试同时使用真实数据库与明确标注的服务替身，未把替身 HTTP 测试称为数据库集成测试。

| 接口 | 实施 / 验证 | 差异与边界 |
| --- | --- | --- |
| A1 session | 已实现；六类当前身份、独立任职能力、停用及旧身份回收已测 | 本人 email 可返回；私人用户字段不进入投影 |
| A2 home | 已实现；真实库空项/成员项、精选选择单测 | 日程与招新最多 50 候选；重点活动单独核验 |
| A3 calendar | 已实现；真实库本人回执、排序/月份/30 天/来源过滤、批量查询次数已测 | 每来源最多 500 候选 |
| A4 event detail | 已实现；真实库公开/社群活动、图片与权限已测 | 纯数字 ID；社团活动支持 slug |
| A5–A6 feed / article | 已实现；真实新闻/影集关联、公告/通知/隐藏父项投影已测 | 新闻/影集按关联解析社群；荣誉聚合首 50 条 |
| A7–A8 communities | 已实现；真实库成员访问、详情、计数/隐藏父项已测 | 访客及停用身份拒绝；计数使用 count |
| A9 contacts | 已实现；真实审批/明确同意/撤回同意/图片授权已测 | 仅在任且同意展示的管理员名片 |
| A10 / A10b showcase / posts | 已实现；真实库公开/本人/待审、批量本人报名提示及投影单测 | 旧接口保留 |
| A11–A12 teams / team | 已实现；真实有效成员关系、公开简介、隐藏简介/父项、内部按队日程筛选已测 | legacyRoster 空；历史资料在 seasons |
| A13 honors | 已实现；复用既有公开档案服务并保留其服务端测试 | 全荣誉目录独立分页；不扩展私有证明权限 |
| A14 recruitment | 已实现；真实访客/成员投影、无效旧批次边界已测 | 无效旧表单不投影；总数含原始可见批次 |
| A15 images | 已实现；真实头像/名片/风采/临时图/活动图、v/ETag/304 与撤权已测 | 媒体 URL 限站内相对地址 |
| A16 uploads | 已实现；真实类型/尺寸/无效图/到期/仅本人读取已测 | 静态 PNG/JPEG/WebP；2 MB、4000 万像素 |
| A17 showcase writes | 已实现；真实投稿/禁言/单次消费/审核 CAS/必填意见已测 | 与网站 action 共用服务；复杂创作仍用旧接口 |
| A18–A19 me / receipts | 已实现；真实本人范围/权限与非答案摘要已测 | 跨集合应用状态按各自 enum 查询 |
| A20 manage | 已实现；真实六身份队列投影、能力独立性已测 | 安全计数不可取则 null |
| A21 fixed pages | 已实现；真实页读取、访客路径与私有前缀单测 | 浏览器跳转验收留给整合阶段 |

## 原服务端覆盖移交

下列替代文件仅保留服务端/模式/路由断言，不读取网站或小程序客户端源码：

- `miniapp-http-contract` → `v2-legacy-http-contract`（6 项）。
- `miniapp-questionnaire` → `v2-legacy-questionnaire`（5 项）。
- `miniapp-signup-methods` → `v2-legacy-signup-methods`（20 项）。
- `miniapp-staff-flows` → `v2-legacy-staff-flows`（18 项）。
- `miniapp-team-signup` → `v2-legacy-team-signup`（31 项）。
- `miniapp-team-profile-confirmation-http` → `v2-legacy-team-profile-confirmation-http`（6 项真实 SQL/JWT/HMAC）。

`miniapp-signup-lifecycle`、`miniapp-content-flows` 其余内容为客户端 VM 生命周期/展示断言，没有另外复制；原测试仍留在树中。没有删去或减弱旧服务端断言。`community-presentation-adapters` 只新增共享 V2 依赖边界登记，原五项断言不变。

最终核验：`pnpm typecheck`、全仓 `pnpm lint`、`git diff --check` 均为 0；15 文件定向回归 209 项通过。最终全量 104 文件、1768 通过 / 43 失败 / 66 跳过，47 个失败签名与既有基线完全一致，无新增失败。新 V2 12 文件 182 项全部通过，含最后新增的 5 项原型属性路由拒绝。隔离生产构建为 0，BUILD_ID `Wir3lUpPWqBzHIli5Ghqd`。

合成环境只使用 loopback 专用数据库和无外发配置，不读取生产环境、邮件、S3 或真实成员资料。浏览器与微信开发者工具的视觉/交互验收由前端整合阶段完成，不以服务测试代替。

## 合同细化与限制

见 `REBUILD_V2_CONTRACT_CHANGES.md`。重点包括旧阵容来源缺失、聚合候选上限、无法执行破坏性 down，以及旧服务完整保留。尚未宣称任何前端视觉已经验收。

## 2026-11-12：S1–S8 后续衔接

任务书各项已处理，完整合同与安全界线见 [S1–S8 衔接记录](REBUILD_V2_SOL_FOLLOWUPS_20261112.md)。新增可报名筛选、轻量社群头、受控图 session 绑定票据、原生 webOnly 声明、队伍保留 slug 校验（含草稿）、独立主场升推投影及 CMS V2 区块配置。S8 无需后端修改。

新增主场区块迁移仅增加结构，旧 site.modules/导航及原服务保留。生产数据碰撞审计/迁移、部署及客户端视觉验收未执行。实际最终验证以 `evidence/rebuild-v2-backend-followups-20261112.json` 为准，下方和上方旧验证数字均保留原范围，不混作本轮全量结果。
