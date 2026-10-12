# 原生小程序代表队适配（2026-10-12）

本轮只在 `codex/miniapp-club-flows-20261012` 继续工作，基线是已上传的原生 **0.3.1**。先前社团切片 `72f580f7806d09b8e249f45c63ae215f190f5fcf` 已冻结，253 项合成用例、72 项真实 Page handler 生命周期用例及成功的 [CI 38218742756](https://github.com/QShin21/zijingwebsite/actions/runs/38218742756) 保留在原记录中。本轮适配源码没有微信官方编译、模拟器、开发上传、真机或审核结果。

## 可验收范围

| 流程 | 已实现 | 边界 / 待验证 |
| --- | --- | --- |
| 建队申请 | 当前服务端允许者选社群、提交组织计划；本人分页记录、反馈、允许时改稿重提和撤回；高权限审核 | 原 `team-core` 服务复核资格、修订与决定；不从前端角色推断权限 |
| 入队招新 | 批次状态及截止时间、完整问卷、部分草稿、正式提交、原编号回执、允许时改稿 / 撤回 / 重提 | 复用 16 类问卷与现有核心校验；不另建团队 API 或公开申请名单 |
| 历史申请 | 隐藏批次或队伍归档后，本人仍查看原快照、原答案与反馈；原生入口只读 | 当前隐藏表单不进入响应；无本人记录仍 404；原生不提供编辑、草稿、提交、撤回或管理按钮 |
| 队伍工作台 | 仅服务端当前授权者查看审核队列、提交决定、批次关闭 / 归档、队伍运营状态、成员关系撤销 | 高级批次制作继续使用既有网页；服务端再次校验每个写动作 |
| 本人成员关系 | 独立分页历史、本人离队；资格与简介展示、历史阵容、社群任职和平台角色分别维护 | `active` 行标作“成员关系未撤销”；归档队伍中的历史行不证明当前可参赛资格 |
| 队员简介 | 本人编辑 / 预览 / 保存 / 隐藏、主动选图与独立展示选择；入队周期变化锁定旧编辑会话 | 已借入最终简介后端；70 项原生 SDK 证明保留，本轮增量统一联测另记录 |
| 已核验荣誉 | 公开档案、标准化图片、受控 `videoHref`、旧荣誉来源跳转、空态 / 重试 / 原生返回 | 已借入最终荣誉媒体安全修复；源码联合验证与平台验证分别记录 |
| 荣誉投稿 / 审核 | 新增本人投稿与当前授权审核工作台、草稿 / 提交、反馈、退回修改、撤回 / 隐藏；图片及独立 MP4 保存 | 最小 GET 层返回当前授权动作，原事务服务执行写入；原生62项页面、111项媒体、15项真实 HTTP / SQL 通过；明确拒绝后清旧动作及播放器，成功GET才恢复 |
| 既有社团功能 | 普通人工入社、名片展示授权、建群改稿撤回、统一骨干申请、授权审核、已审批活动 / 通知 / 风采投影继续保留 | 扫码与点击名片不写成已进群；社区管理员不能因此读取骨干私有答案 |
| 微信平台能力 | 原生导航、登录恢复、主动授权、弱网与重复点击保护、固定本站请求和域名检查保留 | 未申请权限、读取 / 创建平台密钥、部署、上传、审核或发送订阅消息 |

## 服务来源与兼容边界

核心最终来源为 `bf6665c57d83ffa269845c76ff6903d23e0510de`；精确 [CI 38224075245](https://github.com/QShin21/zijingwebsite/actions/runs/38224075245) 于 08:51:51 UTC 成功。核心文档记录 270 项 unit / DB 与 69 项网页 E2E；这些是来源分支证据，不能充当当前合并切片或微信运行证据。

本分支按父任务许可依次移入核心依赖；不合并其分支、不重复执行或创建 `160000` 迁移。首次依赖移入时，`collections/index.ts`、生成类型、迁移注册、账户入口及总状态文档有共享上下文冲突：保留 staff 与 team 两组注册和入口，生成联合 Payload 类型，保留 staff `050000` 先于 team `160000`，不把旧任务状态重新改回未完成。最终两个核心修复增量无冲突、无新迁移。

| 来源提交 | 本分支对应提交 |
| --- | --- |
| `5866adcd`（核心合同） | `27fe744cdc93e0045f21349f5a3cc7c285406d57` |
| `e74e6a4fa`（集合 / 读取权威） | `b708341ca8e3a7c7ee6d6236ca9cba7e4e8878f6` |
| `567e359907`（生成类型） | `9580f8deb5d39fef3f651b2d2521b928f5308a53` |
| `aec6f2675`（服务 / 已有迁移） | `fe5f70f566777024b55c524beadc8fc7cc08a6f5` |
| `88c0653db`（网页 / HTTP） | `de1ec818ba29e5b06e4f69c9f2e7e9a5eebe1a0e` |
| `5f28f95377e9ea4fbf6e4afc54b6cb88e969d33a` | `b062b4abbbac0da2343d7998f32b20e7ab3925d4` |
| `cb1f0de`（只读快照 / 归档保护） | `164e445` |
| `bf6665c57d83ffa269845c76ff6903d23e0510de`（复核证据） | `9dc3bb6` |

只读小程序兼容层的具体缺口是：既有 core HTTP 缺少原生首页、本人建队分页、独立成员分页和授权工作台的统一最小 DTO。独立补丁仅向既有小程序 JSON 网关增加 GET 适配，继续调用当前核心读取服务和 Payload ACL；没有新业务写入、集合或迁移。详情见 [原生队伍 GET 合同](contracts/MINIAPP_TEAM_20261012.md)。所有写入仍为 `/api/team-core` 的已授权操作。

最终核心 `readOnly:true` 的数据仅来自本人申请 `formSnapshot/formVersion`，表单强制禁用关闭。原生 GET 动作和首页撤回入口全部关闭。核心原有本人撤回服务仍按身份、状态与修订规则工作，关闭 / 截止后撤回的原网页语义没有被客户端更改；不能将“原生页无撤回入口”描述成新增后端状态机。

简介消费者按 `3ba056c3dde350b51f28ea72792fe17d54e96b84` 的 HTTP 形状接入；独立查询确认经周期防重放修复后的 `c05bd29b8c7d285065faf0a8274be407bf1b2541` 精确 [CI 38221431931](https://github.com/QShin21/zijingwebsite/actions/runs/38221431931) 于08:33:37 UTC成功。根据父任务后续授权，该服务及原已审迁移现已移入本分支；最初 70 项原生消费者合成证明保持原范围，增量数据库 / HTTP 和网页证明另行记录。`membershipVersion` 与原编辑会话绑定；新建 `revision:null`。换期、旧周期 409、迟到保存后新周期读取均锁定，显式重新加载默认隐藏，再次展示需要用户主动选择。不会用新凭据自动重放旧 `visible:true` 草稿。凭据、修订和原头像 data URI 存在实例私有字段，页面展示数据只保留必要文本、选择及临时图片。

头像 PUT 要求本站来源，原请求层未传该头；传输兼容仅对明确设置 `siteWrite:true` 的已认证写请求附固定本站 `Origin`，保留服务端校验，不提供任意 header 覆盖。同时只转递 409 的 `PROFILE_PERIOD_CHANGED`，其它内部错误字段丢弃。旧请求迟到401仅在其凭据仍是当前凭据时清理会话，避免清掉后来换账号或重新登录的有效会话。

荣誉最终依赖 `196ebf841c77f7a725ed6b41100cd66b341faea5` 已移入本分支；其精确 [CI 38227427404](https://github.com/QShin21/zijingwebsite/actions/runs/38227427404) 于09:33:08 UTC成功，来源分支 282 项 unit / DB 和65项网页 E2E 与当前切片验证独立。原生不读取、存储、展示或回退到原始 `videoURL`；受控路径须匹配对应记录 ID 及修订 / 批准版本。新增两页连接同一原写接口，列表和详情 GET 仅补齐原服务授权动作。具体缺口、写入白名单、单文件 MP4 流程及弱网边界见 [荣誉读写合同](contracts/MINIAPP_TEAM_HONORS_20261012.md)。

简介的14条及荣誉的6条来源提交映射保存于证据 JSON。跳过已存在的核心依赖与相同 `160000` 迁移提交；冲突处保留 staff / core / profile / honor 集合和入口，重新生成联合类型，迁移注册为 staff `050000`、honor `080000`、core `160000`、profile `170000`。原 `160000` 只注册一次，简介在核心之后；已应用核心的合成库本轮仅增量执行 `080000` 与 `170000`。来源分支的 JSON 结构快照保留原样，最终统一快照仍由父任务负责，未自动生成新 DDL。

## 原生状态与弱网

生成问卷和 `templates/questionnaire.wxml` 没有改动，继续使用 `X-Questionnaire-Version:3`；保留 text、textarea、single、multiple、select、number、date、time、rating、nps、ranking、matrix、matrixMultiple、blanks、group、description，复杂跳转 / 分页、提前结束及五至六人组。入队的五项核心资料由服务端原校验保留，高级表单制作没有缩成四类。

业务按钮来自每次 GET 的服务端 `actions`。临时 pending / modal / file 锁、页面 scope、账号和路由上下文只控制本地异步结果；不复制审核与成员资格状态机。跨 hide/show 的写操作及确认框锁保留到 finally，阻止第二次写入。后台完成不发额外读取，前台恢复只 GET 当前记录；旧账号、旧路由或 unload 的迟到结果不能落入新页。若 POST 成功但确认 GET 失败，显示真实保存状态并关闭旧动作，允许手动重读。入队报名页为迟到成功提供独立的“上次保存已确认”只读回执，403/404及账号变化不显示旧确认。简介对账还需确认当前入队周期与不早于已确认保存的修订；队伍/批次状态保存后全部旧审核动作暂清，成功GET才恢复。网络失败保留当前草稿和处理意见。

新队伍四页之外，还按冻结基线的实际 Page 与 deferred POST 复现并修复普通建群、建群审核、人工进群管理及骨干审核页面的相同时序缺口；新增独立测试，既有测试和历史证据保留。详情与精确数量见 [本轮证据](evidence/miniapp-team-flows-20261012.json)。

## 微信官方事实与项目选择

2026-10-12 查询当前官方平台 / 开发文档。微信文档站正文仍不可达（工具 `non-retryable error`、容器 CONNECT 403），搜索也没有取得可靠官方正文，故未据此宣称当前审核条款已复核通过。当日重新 `git ls-remote` 确认微信官方 `api-typings` HEAD 仍为 `6092df9100c73b84e140c20b9a42a8e8799e0660`；其 [生成说明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/README.md) 与 [API 声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts) 可读，只作为可核验 API 事实来源。

| 官方声明中已读的事实 | 本项目选择 / 验证边界 |
| --- | --- |
| request / upload / download 使用 HTTPS；下载回调仍需检查 HTTP 状态。[网络声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L22759) | 凭据请求固定本站，`urlCheck:true`；新增头像通过现有 JSON PUT，受控视频用本站 HTTPS。真实域名、TLS、重定向仍待平台验证 |
| uploadFile声明为 HTTPS multipart POST，单份 `filePath/name`，结果 data 为字符串；downloadFile提供 filePath / statusCode。[上传选项](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L13736)、[下载选项](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L4894) | 原生荣誉先明确保存图片草稿，再单独上传一份MP4；JWT私有下载核对200并使用自有本地路径。这些为项目设计，真实SDK上传和播放待测 |
| `wx.request` 允许 header 字段，禁止设置 Referer，支持 PUT。[请求选项](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L10851) | 限定写请求增加本站 Origin；声明不能证明微信各端实际保留此头，须官方工具 / 真机实测 |
| 微信登录接口返回 code。[登录声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L26410) | 沿用网站 JWT，无微信身份绑定、session_key 或 AppSecret 操作 |
| 隐私辅助接口可在真实隐私接口前调用；拒绝会走失败回调。[隐私声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L30742) | 仅主动选图 / 视频时调用现有原生隐私流程；拒绝 / 取消不读文件；简介展示勾选另行处理 |
| 图片预览支持长按；订阅请求需要用户点击或支付回调。[预览](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L29961)、[订阅](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L30623) | 预览不证明好友或进群；本轮没有自动订阅弹窗或真实消息发送 |

待人工只读核对的官方页面：[网络 / 合法域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)、[登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)、[隐私指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)、[图片预览](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.previewImage.html)、[web-view / 外链](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)、[视频](https://developers.weixin.qq.com/miniprogram/dev/component/video.html)、[上传](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/wx.uploadFile.html)、[下载](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/wx.downloadFile.html)、[订阅](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)、[平台运营规范](https://developers.weixin.qq.com/miniprogram/product/operation.html)。当前客户端无 web-view；外链主动复制与管理员二维码展示的审核适用性仍需平台复核。

## 验证与平台检查点

合成 PostgreSQL 为本容器独占随机目录、loopback `55578`、`miniapp_team_qa` 库；显式 `APP_ENV=development`、`DB_PUSH=false`，禁用外部 SMTP / S3。只使用合成账号、问卷、申请和媒体；未调用生产、平台凭据或真实用户。

已实际执行联合迁移及核心迁移兼容演练：62 个既有表、9 个合成行保留；旧表哈希 `90e1becafbe6552888fe3a107ade12f7a0e0f4be6a5cf218d30eb88fa202b633` 不变，无隐式成员关系，旧队伍仍未批准成立，重复运行无变化，非空核心数据 down 被拒绝。新增两张 staff 表使联合演练表数为 62；不挪用核心独立分支的 60 表数字。最终 core 修复后的 23 项 core / review / staff 合成数据库测试已通过。

早期队伍切片实际执行6项真实路由handler + JWT / ACL / 合成SQL联测，以及9项 Chromium 网页 E2E（核心、核心复核和骨干，2.5分钟）；构建成功。上述为早期队伍切片的证明；其758项全仓及502项原生用例保存在 preHonorWriteSlice，不冒充新增荣誉写入结果。Node VM Page handler、模拟的 wx 回调、真实服务 + 合成数据库、网页 Playwright 各自独立标注，均不等于微信官方组件或真机通过。

荣誉写入追加真实15项 HTTP / SQL 全通过，包含现有核心完整申请 / 人工录取链、JWT、动作提示、scope、旧任职失效、JSON白名单、超限分块流、multipart、MP4当前修订 / 批准版本、HEAD / Range / 原存储404。构建当前于24.8秒编译成功、10.1秒 TypeScript 完成，exit0。联合网页首轮18项通过，荣誉4项因来源分支的 `_synthetic` 库名门禁未执行业务；创建符合门禁的独立空库并实际执行全部迁移后，4项受影响荣誉测试全通过（1.5分钟），累计22项真实网页回归通过，未改旧门禁或模拟 CI。

空库联合简介迁移演练完成：baseline64表、核心后68表、简介后69表；原列及数据保留分别63 / 67表，旧队伍未获得成立状态、无凭空成员关系，核心记录与唯一索引保留，真实简介写入及首次创建重试验证通过。生成演练库已清理，原来源分支的迁移证据保留；当前独立证据见 [联合迁移演练](evidence/miniapp-team-profile-migration-20261012.json)。

最终全仓 **60文件1030项 unit / DB 全通过，无失败或跳过**；小程序相关21文件690项（包括真实路由 / SQL21项），原报名72、入队问卷72、队伍工作台73、简介70继续通过。新增荣誉页面62、媒体111、真实HTTP15；静态检查25页142文件457658B，域名检查开启、原生依赖0，源码版本仍0.3.1。类型 / lint / diff检查通过。当前源码已推送 `cd337eb2451991548424f4084a906a8202633636`，精确 [CI 38236841206](https://github.com/QShin21/zijingwebsite/actions/runs/38236841206) 运行中；文档提交与该代码CI分开记录，不宣称待完成CI成功。

独立复核复现并关闭两处拒绝后的旧动作 / 媒体空态P2：新增13例修前49通过 / 13失败，修后62全通过；另外6个独立NodeVM实证确认拒绝后POST0、旧本地视频文件清理、迟到拒绝不污染新账号 / 路由，原失败证据保留。首次检查点 `8dc1db0` 的 [CI 38231312915](https://github.com/QShin21/zijingwebsite/actions/runs/38231312915) 因浅克隆读不到72f历史源码，737通过而21条生命周期测试模块未加载；现将原JS / WXML精确归档为测试夹具并校验原SHA256，21条负向与修复证明保持，未删断言或放宽CI门禁。

原生未增加高级批次表单制作或CMS编辑器；这些沿用既有网页授权入口。除明确列出的微信平台检查外，本轮已存在社团 / 队伍 / 简介 / 荣誉流程均有动态服务消费者，未内置测试社团事实。

可执行平台步骤：

1. 本分支已借入核心与最终简介 / 荣誉依赖，并在本容器独立合成 SQL 库联测。拥有现有访问权的验证者还需在已授权的隔离 HTTPS 服务验证网页 / 微信原生的同一申请编号、修订、授权和私有答案范围。若没有已登记合法域名的隔离服务，保留网络联测为未验证，不把生产入口改作测试服务或写入生产申请。
2. 已有开发权限者导入 `miniprogram/project.config.json`，保持域名检查，记录开发者工具与基础库版本，执行官方编译和模拟器。无需申请权限、密钥或上传。
3. 只读核对 request、downloadFile、现有 uploadFile、业务域名、本站及媒体 TLS / 重定向 / Range；实际测试 PUT 的 JWT + Origin 在微信各端的服务端接收值，不记录凭据。失效时停在明确错误，不放宽 CSRF 或权限校验。
4. 以合成账号跑完整 16 类、复杂分支及五至六人组、部分草稿、原编号改稿 / 撤回 / 重提、权限撤销、闭批和历史只读。给写入与确认读取分别注入延迟、失败，覆盖后台先完成 / 前台再完成、换账号 / 换路由 / 返回；每次主动操作最多一条写入。
5. 核对隐私声明中的头像、昵称、申请答案、联系资料与二维码；试同意 / 拒绝 / 取消选图及选视频。简介周期 A 离队再入队 B 后尝试 A 的迟到保存，应409并锁定；显式重读默认隐藏，再次主动勾选后才可展示。
6. 荣誉仅播放受控地址；在隔离服务撤回核验、撤回展示和撤销成员资格后检查旧版本 / Range / 相同媒体跨渠道请求均按最终服务安全规则失效，原生没有 raw videoURL 后备路径。用合成图片检查长按、返回和临时文件清理；验证明确保存 JSON → 独立上传 MP4 → 另行提交的三次主动操作，失败无自动重发。已合法下载的字节无法靠服务端撤回追溯收回，原生在离开和身份变化时清理自有临时文件。
7. 记录官方模拟器和 iOS / Android 真机结果，再由父任务决定发布；本轮不提交审核、不上传正式版本、不发送订阅消息，不声称审核必过。
