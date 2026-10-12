# 代表队队员简介 · 独立模块

基线 `beac037eafe88b9b82e171e15cfddcca351b838b`，工作分支 `codex/team-profiles-20261012`。只用合成资料开发与验收，不读取真实会员资料、不通知成员、不生产迁移、不部署、不创建 PR、不合并其他功能分支。

## 所有权与依赖

独占 `src/lib/team-profiles*`、`src/collections/team-profiles.ts`、`src/components/team-profiles/*`、`src/app/(frontend)/api/team-profiles/**`、`src/app/(frontend)/teams/profiles/**`、`tests/team-profiles*.test.ts`、`tests/e2e/team-profiles.spec.ts`、`src/migrations/20261012_170000_team_member_profiles.ts`、本文。

共享最小集成补丁：`src/collections/index.ts`（只注册简介集合）、`src/migrations/index.ts`（只注册独立迁移）、`src/payload-types.ts`（生成类型）、`src/components/Content.tsx`（代表队详情挂载独立组件）、`docs/TASKS.md / docs/STATUS.md / docs/DECISIONS.md`。共享注册/类型独立提交，集成者合并条目并重生成类型，禁止整文件覆盖其他模块改动。

唯一权威成员关系由核心任务 `01a12ec0-2821-70b0-881a-6d39382880c9` 维护。简介集合 `team-member-profiles` 只关联唯一 `membership`，不复制账号或成员状态。`users.teams`、`seasons.members`、微信群入社及任职均不代表代表队成员。每次编辑/保存及公开名单读取须调用核心实时资格服务。

已只读正式核心合同及实现（远端核心提交 `567e359907418a2ebdb14833cfc5838901a09892`）：`src/lib/team-memberships.ts` 的 `getActiveTeamMembership / listActiveTeamMemberships`，底层关系字段 `member`，服务投影 `userID`。当前第二切片的生产 authority 明确拒绝访问，尚未绑定；这些单元测试不代表真实成员权限集成通过。后续在隔离本地集成目录组合核心提交与本模块，不复制或改写核心成员实现，仅推送本模块自己的提交。

## 数据与隐私

公开昵称、可选上传头像、位置/游戏角色、400 字纯文本介绍、本人展示选择；默认隐藏。拒绝 HTML、任意头像外链、敏感/资格字段。头像复用 `normalizeShowcaseImage` 的真实解码、静态格式限制、像素/大小上限与去元数据重新编码。无富文本、自由外链或公开媒体集合依赖。

当前已有 `handleJoins` 能力处理进群/核心入队；它未明确授予代改他人的公开简介。简介编辑默认仅当前有效成员本人，功能不扩展角色任免或私人报名读取能力。

访问沿用代表队栏目登录边界，名单仅展示当前有效成员且自愿展示的资料；原始 membership/user 关系及隐藏资料不直接向访问者公开。离队、被移除、停用账号和归档队伍均依赖核心实时过滤，旧页面保存须再次验证。

## 当前验证

第一切片 `c890ed2f1e1b52de6bff5cf1b2381b3dc3882390`：最小资料模型、白名单/标识/错误隔离、复用头像安全处理，32 项合成单元测试通过。

第二切片：独立服务/集合/加法迁移、HTTP 边界、名单/编辑/预览/保存/隐藏组件、专用 `/teams/profiles/[teamID]` 页面。类型检查、限定 lint 与 39 项模型/HTTP/卡片合成测试通过；未注册集合/运行简介迁移，生产 authority 尚拒绝访问。尚未执行实际网页或真实核心资格验收，不能宣称闭环集成已通过。
