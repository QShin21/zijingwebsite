# 代表队队员简介 · 2026-10-12 交付

基线 `beac037eafe88b9b82e171e15cfddcca351b838b`；工作分支 `codex/team-profiles-20261012`。简介模块已接入真实核心 schema 与实时成员读取接口，本人编辑、预览、保存、修改、隐藏及名单展示闭环已通过。最终应用切片 `adfd2c955216f0f2bde1ef1a8bc7cacf9609746a`；304 项全套单元/数据库测试在 `890a2d7e94356704432937637986e6f1d825da3d` 通过，其后应用变化仅为表单/按钮样式，6 项简介 E2E 已在最终应用切片复验通过。

只使用隔离合成资料。没有读取真实成员资料、向真人触达、生产迁移、PR、合并或部署；只推送上述分支。

## 所有权与精确前置依赖

本模块拥有 `src/lib/team-profiles*`、`src/collections/team-profiles.ts`、`src/components/team-profiles/*`、`src/app/(frontend)/api/team-profiles/**`、`src/app/(frontend)/teams/profiles/**`、`tests/team-profiles*.ts`、`tests/e2e/team-profiles.spec.ts`、`src/migrations/20261012_170000_team_member_profiles.ts`、`scripts/team-profiles-migration-check.ts` 和本文及简介证据文件。

父任务明确授权引入下列核心前置项；它们属于核心任务，未冒充简介原创。前三项带 `cherry-pick -x` 来源记录；注册冲突逐项保留两模块，类型从合并后的配置重新生成。

| 核心来源                                                                               | 本分支对应提交                             | 范围                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `5866adcd8a638273f23f2f66e3992e48f2a46873`                                             | `caef767c88817adefe2b006f723afba7fa293484` | 核心接口合同                                                                              |
| `e74e6a4fa7281bcd2edcf667343b9e653380f40d`                                             | `0fc075128a1fb6c3102e7c7a43944fe70f91f9e8` | 权威四集合、实时读取库、最小注册/类型/生命周期字段                                        |
| `567e359907418a2ebdb14833cfc5838901a09892`                                             | `9f978e52fe5997eca5ef468baa9773211fe477c8` | 核心类型修正                                                                              |
| `aec6f2675fbbe6074ad3867cff21e6fc69c6adaa:src/migrations/20261012_160000_team_core.ts` | `31d990e0f91a9cb91b783d0e75f421396347315b` | 仅原样核心迁移 TS 和最小索引合并，文件对象哈希 `a47f81e6a8f62f596da3bb2808750216c114257d` |

**统一集成若已含上述核心来源，请跳过这四个依赖提交，合并简介自身切片与必要共享条目，避免重复迁移/重复注册。** 本分支未引入核心业务工作流 `src/lib/team-core.ts`、核心 UI 或其 JSON 快照。

## 成员、数据与权限边界

`team-memberships` 是唯一成员权威。简介 `team-member-profiles.membership` 为唯一、不可换绑的数字关系；不复制用户账号、team/user 名单、游戏范围或成员状态。编辑/保存调用 `getActiveTeamMembership(p,{teamID,userID,req})`；名单调用 `listActiveTeamMemberships(p,{teamID,req})`。核心实时验证 active 关系、可用账号、已批准建队闭环、发布且未归档的队伍和游戏。`users.teams`、`seasons.members`、普通微信群关系或管理员标签均不授写入资格。

保存在 serializable 事务内重新读取账号和核心成员关系，集合钩子再次检查同一关系与队伍。数字 revision 防止旧页覆盖；重复同资料请求收敛，冲突仅重试一次并重新验证资格。撤销之后，包括旧会话和重复请求，均拒绝写入；名单即时过滤撤销、停用或归档。资料保留供合格本人后续编辑。

公开字段仅 `id`（简介 ID）、`displayName`、`position`、`biography`、`avatar`。本人回执另含 visible/revision，不向访问者返回用户/成员关系 ID、报名作答、联系方式、真实姓名、学号或审核备注。原始集合 REST/GraphQL/Local 读取及直接写入关闭；受控服务通过内部上下文限定本人或当前已授权展示关系，再以 `overrideAccess:false`、匿名身份和最小选择读取名单。

默认隐藏，本人明确勾选展示后保存。离队/移除后不展示；核心重新录取复用 ID 并重置 joinedAt 时，旧展示授权不能自动复活。简介的 membershipJoinedAt 仅为当前展示授权周期，不是任期历史或第二份资格。现有 handleJoins 未明确授予代改他人简介，因此本功能不增加管理员代改、任免或私人报名能力。

简介为最多 40 字昵称、60 字位置/游戏角色、400 字普通文本介绍和可选头像。拒绝 HTML、不可见控制字符、任意头像外链以及附加敏感/资格字段。头像复用 `normalizeShowcaseImage` 的实际字节解码、静态 PNG/JPEG/WebP、2 MB/像素限制和去元数据 WebP 重编码，存于受控简介资料，不使用公开 media 上传。浏览器模型不导入 Payload 服务端代码。

## 挂载与共享补丁

代表队详情 `src/components/Content.tsx` 仅加独立 `<TeamProfilesPanel teamID={doc.id}/>`，不改核心生命周期或荣誉页面。独立编辑页 `/teams/profiles/[teamID]` 支持返回 `/teams/[slug]#team-members`；组件可供核心/统一入口重用。

`GET /api/team-profiles/[teamID]` 返回受控名单及当前用户自己的可编辑状态；`PUT` 仅接受 `{revision, membershipVersion, profile:{displayName,position,biography,avatar,visible}}`，拒绝 HTTP context/overrideAccess/member/game/status 等事实。API 使用登录边界、同源检查、流式 2.9 MB 上限和 `private,no-store`。站点原有代表队登录边界保持。

共享简介集成补丁单独提交 `68c8b81008cc53246f8504ac1ac8053f6efe6544`：collection 注册、迁移索引、生成类型和详情挂载共四文件。后来明确授权的核心依赖使这些文件同时包含核心最小项，统一集成按条目合并并重生成类型，禁止整文件覆盖。

迁移顺序必须为核心 `20261012_160000_team_core` 后简介 `20261012_170000_team_member_profiles`。应用在迁移全部完成后启动；Payload 文档更新会查询所有已注册 lock 关系。两模块 down 均拒绝自动删表，回滚应用时保留资料。最终全模块结构快照由统一集成者整理，本任务没有运行自动生成的删除/重复 DDL。

## 实际验证与限制

本分支类型检查、全仓 lint、304 项全套单元/数据库、51 项简介定向检查、6 项真实网页 E2E 和优化生产构建通过。最终界面使用既有 member-form/light 样式，桌面 1440px 和窄屏 320/390/768px 无横向溢出；简介区域 Axe 无障碍扫描无违规。覆盖空名单、加载/保存失败与保留输入、预览/返回/取消、头像移除、重复保存、双页冲突、跨队、隐藏、撤权旧页拒写、真实 schema 的完整资格前提及最小投影。证据见 `docs/evidence/team-profiles-20261012.json` 与 `team-profiles-migration-20261012.json`；本地合成截图位于 `.data/team-profiles-preview-390.png`、`.data/team-profiles-preview-1440.png`。

迁移演练从新空库逐次执行旧基线→核心→简介，61→65→66 表；核心保留 60 张旧业务表的原列数据，简介保留 64 张原表数据（含已有权威关系）。唯一预期变化为迁移日志；旧队伍仍为 unestablished、没有从旧资料编造成员，唯一关系索引及迁移后的真实读取/简介写入与重复保存通过。演练不迁移原开发库，更未连接生产。

最终夹具仅通过核心内部写上下文构造合成有效权威链，**成员判定使用真实数据库与真实核心 getter，没有 mock 资格**。验收范围为真实 schema + 实时读取 API + 简介网页闭环；完整“申请建队→审核→招新→录取”核心运营网页链及荣誉统一入口不属于本模块完成声明，仍由核心与总集成验收。此前隔离组合试验不代替最终分支证据；精确远端 CI 结果单独记录，未完成的 CI 不称通过。

## 独立审查修复：再入队周期并发凭据

旧资料 revision 不随离队/重新录取变化，原实现仅在资料相同比较中检查 joinedAt，旧页或旧请求能把 visible=true 带入新周期。这一版本存在真实授权阻断，旧验证不覆盖该重放，现由 `45d810b927e10c6437fe31dd5f140c27bda8e46c` 修复。

GET 的 own 增加 `membershipVersion`，只向当前本人返回服务端 HMAC 生成的不透明凭据；签名绑定真实 membership ID、teamID、userID 和当前 joinedAt，不公开这些原始字段。PUT 必须带该凭据，服务和集合钩子均用事务内实时核心关系验证，且验证在幂等、头像处理和全部写入之前。缺失、伪造、自报日期、跨队或旧周期凭据统一 409 / PROFILE_PERIOD_CHANGED，不增加 revision、不修改资料、不恢复展示。没有修改核心成员权威或数据库模式。

编辑器保留首次加载周期凭据，普通后台刷新不能换绑旧 checked 草稿；旧周期失败或保存响应迟到后发现新周期，锁住编辑并要求明确重新加载。重载后旧周期资料默认隐藏，新的本人展示选择才可保存公开。针对公开/隐藏资料、旧空编辑器、重复撤销重录、旧页/重放 PUT、异步迟到请求和迟到保存响应增加真实 schema/getter 与浏览器回归。最终修复测试与 CI 记录见 `evidence/team-profiles-period-20261012.json`；上方初次交付记录为历史结果。

最终代码提交 `c05bd29b8c7d285065faf0a8274be407bf1b2541` 的 [CI 38221431931](https://github.com/QShin21/zijingwebsite/actions/runs/38221431931) 于 2026-10-12 08:33:37 UTC 成功：308 项单元、70 项网页（含本模块 9 项、周期回归 3 项）、迁移、类型、Lint、小程序检查、构建全部通过。本地定向 55 项、九项网页及构建通过；顺序组合本地曾出现其他注册用例的登录 ECONNRESET，完整远端同提交已全部通过，原失败记录保留在证据文件。前次 `223d9eb` CI 为 69 通过、1 项简介 beforeEach 超时；`c05bd29` 将两份简介浏览器测试的 Payload 实例按 key 隔离，并保护未初始化夹具的清理。后续证据文档提交不改变代码、测试、核心权威或 schema；CI 通过声明严格对应上述代码 SHA。
