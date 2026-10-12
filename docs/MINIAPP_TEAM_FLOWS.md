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
| 队员简介 | 按已交 HTTP 合同读取、本人编辑 / 预览 / 保存 / 隐藏、主动选图与独立展示选择；入队周期变化锁定旧编辑会话 | 当前分支未引入简介后端依赖；须由父任务集成最终简介服务后做联合验证 |
| 已核验荣誉 | 只读公开档案、标准化图片、受控 `videoHref`、旧荣誉来源跳转、空态 / 重试 / 原生返回 | 荣誉后端安全修复及最终写入 HTTP 合同尚待父任务交付；投稿 / 审核未实现 |
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

简介消费者按 `3ba056c3dde350b51f28ea72792fe17d54e96b84` 的 HTTP 形状接入；独立查询确认经周期防重放修复后的 `c05bd29b8c7d285065faf0a8274be407bf1b2541` 精确 [CI 38221431931](https://github.com/QShin21/zijingwebsite/actions/runs/38221431931) 于08:33:37 UTC成功。该服务未移入本分支，当前原生证明范围为真实消费者及合成传输。`membershipVersion` 与原编辑会话绑定；新建 `revision:null`。换期、旧周期 409、迟到保存后新周期读取均锁定，显式重新加载默认隐藏，再次展示需要用户主动选择。不会用新凭据自动重放旧 `visible:true` 草稿。凭据、修订和原头像 data URI 存在实例私有字段，页面展示数据只保留必要文本、选择及临时图片。

头像 PUT 要求本站来源，原请求层未传该头；传输兼容仅对明确设置 `siteWrite:true` 的已认证写请求附固定本站 `Origin`，保留服务端校验，不提供任意 header 覆盖。同时只转递 409 的 `PROFILE_PERIOD_CHANGED`，其它内部错误字段丢弃。旧请求迟到401仅在其凭据仍是当前凭据时清理会话，避免清掉后来换账号或重新登录的有效会话。

荣誉消费者基于 `397d6092e11c5b29a91916a5fead339c1a5602c4` 的只读形状，并为父任务已发现的媒体撤回边界保留严格限制：不读取、存储、展示或回退到原始 `videoURL`；受控视频路径须匹配对应记录 ID 及版本。错误时提示重新读档案，无原始媒体替代入口。父任务仍须集成最终安全版本；本文不宣称跨渠道撤回已经在当前分支端到端验证。

## 原生状态与弱网

生成问卷和 `templates/questionnaire.wxml` 没有改动，继续使用 `X-Questionnaire-Version:3`；保留 text、textarea、single、multiple、select、number、date、time、rating、nps、ranking、matrix、matrixMultiple、blanks、group、description，复杂跳转 / 分页、提前结束及五至六人组。入队的五项核心资料由服务端原校验保留，高级表单制作没有缩成四类。

业务按钮来自每次 GET 的服务端 `actions`。临时 pending / modal / file 锁、页面 scope、账号和路由上下文只控制本地异步结果；不复制审核与成员资格状态机。跨 hide/show 的写操作及确认框锁保留到 finally，阻止第二次写入。后台完成不发额外读取，前台恢复只 GET 当前记录；旧账号、旧路由或 unload 的迟到结果不能落入新页。若 POST 成功但确认 GET 失败，显示真实保存状态并关闭旧动作，允许手动重读。入队报名页为迟到成功提供独立的“上次保存已确认”只读回执，403/404及账号变化不显示旧确认。简介对账还需确认当前入队周期与不早于已确认保存的修订；队伍/批次状态保存后全部旧审核动作暂清，成功GET才恢复。网络失败保留当前草稿和处理意见。

新队伍四页之外，还按冻结基线的实际 Page 与 deferred POST 复现并修复普通建群、建群审核、人工进群管理及骨干审核页面的相同时序缺口；新增独立测试，既有测试和历史证据保留。详情与精确数量将在完成验证后写入 [本轮证据](evidence/miniapp-team-flows-20261012.json)。

## 微信官方事实与项目选择

2026-10-12 查询当前官方平台 / 开发文档。微信文档站正文仍不可达（工具 `non-retryable error`、容器 CONNECT 403），搜索也没有取得可靠官方正文，故未据此宣称当前审核条款已复核通过。当日重新 `git ls-remote` 确认微信官方 `api-typings` HEAD 仍为 `6092df9100c73b84e140c20b9a42a8e8799e0660`；其 [生成说明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/README.md) 与 [API 声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts) 可读，只作为可核验 API 事实来源。

| 官方声明中已读的事实 | 本项目选择 / 验证边界 |
| --- | --- |
| request / upload / download 使用 HTTPS；下载回调仍需检查 HTTP 状态。[网络声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L22759) | 凭据请求固定本站，`urlCheck:true`；新增头像通过现有 JSON PUT，受控视频用本站 HTTPS。真实域名、TLS、重定向仍待平台验证 |
| `wx.request` 允许 header 字段，禁止设置 Referer，支持 PUT。[请求选项](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L10851) | 限定写请求增加本站 Origin；声明不能证明微信各端实际保留此头，须官方工具 / 真机实测 |
| 微信登录接口返回 code。[登录声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L26410) | 沿用网站 JWT，无微信身份绑定、session_key 或 AppSecret 操作 |
| 隐私辅助接口可在真实隐私接口前调用；拒绝会走失败回调。[隐私声明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L30742) | 仅主动选图时调用现有原生隐私流程；拒绝 / 取消不读文件；简介展示勾选另行处理 |
| 图片预览支持长按；订阅请求需要用户点击或支付回调。[预览](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L29961)、[订阅](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L30623) | 预览不证明好友或进群；本轮没有自动订阅弹窗或真实消息发送 |

待人工只读核对的官方页面：[网络 / 合法域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)、[登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)、[隐私指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)、[图片预览](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.previewImage.html)、[web-view / 外链](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)、[视频](https://developers.weixin.qq.com/miniprogram/dev/component/video.html)、[上传](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/wx.uploadFile.html)、[下载](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/wx.downloadFile.html)、[订阅](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)、[平台运营规范](https://developers.weixin.qq.com/miniprogram/product/operation.html)。当前客户端无 web-view；外链主动复制与管理员二维码展示的审核适用性仍需平台复核。

## 验证与平台检查点

合成 PostgreSQL 为本容器独占随机目录、loopback `55578`、`miniapp_team_qa` 库；显式 `APP_ENV=development`、`DB_PUSH=false`，禁用外部 SMTP / S3。只使用合成账号、问卷、申请和媒体；未调用生产、平台凭据或真实用户。

已实际执行联合迁移及核心迁移兼容演练：62 个既有表、9 个合成行保留；旧表哈希 `90e1becafbe6552888fe3a107ade12f7a0e0f4be6a5cf218d30eb88fa202b633` 不变，无隐式成员关系，旧队伍仍未批准成立，重复运行无变化，非空核心数据 down 被拒绝。新增两张 staff 表使联合演练表数为 62；不挪用核心独立分支的 60 表数字。最终 core 修复后的 23 项 core / review / staff 合成数据库测试已通过。

已另行实际执行6项真实路由handler + JWT / ACL / 合成SQL联测，以及9项 Chromium 网页 E2E（核心、核心复核和骨干，2.5分钟）；构建成功。本轮最终全量测试、包大小和提交 / CI 将在完成后记录于证据 JSON。Node VM Page handler、模拟的 wx 回调、真实服务 + 合成数据库、网页 Playwright 各自独立标注，均不等于微信官方组件或真机通过。

可执行平台步骤：

1. 父任务在已授权的隔离服务集成当前核心与最终简介 / 荣誉依赖，再用合成账号验证网页 / 原生的同一申请编号、修订、授权和私有答案范围；未集成服务的简介 / 荣誉页面不能认定已联网可用。若没有已登记合法域名的隔离服务，保留网络联测为未验证，不把生产入口改作测试服务或写入生产申请。
2. 已有开发权限者导入 `miniprogram/project.config.json`，保持域名检查，记录开发者工具与基础库版本，执行官方编译和模拟器。无需申请权限、密钥或上传。
3. 只读核对 request、downloadFile、现有 uploadFile、业务域名、本站及媒体 TLS / 重定向 / Range；实际测试 PUT 的 JWT + Origin 在微信各端的服务端接收值，不记录凭据。失效时停在明确错误，不放宽 CSRF 或权限校验。
4. 以合成账号跑完整 16 类、复杂分支及五至六人组、部分草稿、原编号改稿 / 撤回 / 重提、权限撤销、闭批和历史只读。给写入与确认读取分别注入延迟、失败，覆盖后台先完成 / 前台再完成、换账号 / 换路由 / 返回；每次主动操作最多一条写入。
5. 核对隐私声明中的头像、昵称、申请答案、联系资料与二维码；试同意 / 拒绝 / 取消选图。简介周期 A 离队再入队 B 后尝试 A 的迟到保存，应409并锁定；显式重读默认隐藏，再次主动勾选后才可展示。
6. 荣誉仅播放受控地址；在隔离服务撤回核验、撤回展示和撤销成员资格后检查旧版本 / Range / 相同媒体跨渠道请求均按最终服务安全规则失效，原生没有 raw videoURL 后备路径。用合成图片检查长按、返回和临时文件清理。
7. 记录官方模拟器和 iOS / Android 真机结果，再由父任务决定发布；本轮不提交审核、不上传正式版本、不发送订阅消息，不声称审核必过。

