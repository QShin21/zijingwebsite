# 原生小程序社团流程适配 · 2026-10-12

> 本文为冻结社团切片 `72f580f7806d09b8e249f45c63ae215f190f5fcf` 的历史验收记录。其精确CI 38218742756已成功；后续代表队依赖、原生功能及旧页写入锁补丁见 [代表队适配记录](MINIAPP_TEAM_FLOWS.md)，不改变本文253项/72项原始证明的范围。

本轮从 CI 成功的 `ed965ef457b5913d4590753c9d931e82811244b9` 出发，只在 `codex/miniapp-club-flows-20261012` 工作。基线是原生小程序 **0.3.1**；当前分支的适配源码尚未经过微信开发者工具编译或上传。保留 `config.version:0.3.1`、AppID、基础库配置 `3.16.0` 和 `urlCheck:true`。之前 0.3.1 开发上传记录见 [MINIAPP.md](MINIAPP.md)，不代表本轮源码已经上传。

独立兼容补丁为 `4cb3d64`；前端及合成测试提交为 `9bfafb04f1f8df07d375a4e9242bfd9d05a07626`，活动工作台退出保护补丁为 `c77dc9f01a289f06b40dc772fcdaec3f0f016049`，报名页生命周期修复为 `b2adf41c350c4ac27388fdf427450a8d8b5d7938`。除 `src/lib/miniapp-club.ts` 和既有小程序 JSON 网关外，修改范围为小程序、相关测试及本文档。未改集合、迁移、业务服务、其他分支或生产环境。

## 本轮验收切片

主页和每个社群的当前骨干批次进入同一个 `signup?kind=staff&id=<批次>` 页面。填写、返回上一步、核对、提交、本人回执、改稿、撤回及重提都使用网页服务；普通入社继续通过游戏社群联系管理员。二维码预览没有任何入群写操作。

| 流程                                                  | 本轮源码结果                                                                                               | 实际验证 / 仍待验证                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 普通入社                                              | 找游戏社群、授权名片、手动加好友与人工拉群说明；自愿记录意向、主动报告好友申请、撤回网站意向               | 合成页面通过；真实微信识码、好友和群状态未验证                       |
| 建群 / 管理员申请                                     | 新建或参与管理、本人回执与反馈、退回或撤回后同编号改稿、待审撤回；批准后更新名片及单独展示授权             | 合成页面与兼容契约通过；没有真实申请或新建生产社群                   |
| 社区活动 / 通知 / 风采                                | 保留社区原文、分页、图像、原生 MP4 和外链复制；名片加载失败独立重试，不挡其他分区                          | 合成页面通过；微信实际媒体加载未验证                                 |
| 社团活动 / 通知 / 风采                                | 首页、活动通知页、发现入口及社群页复用既有 `promotedContent` 已审批投影，点击回到原内容                    | 合成契约与页面通过；未新增客户端审批规则或升推写接口                 |
| 骨干招新                                              | 当前与历史批次、本人历史状态、完整表单、同记录修改、撤回和重提；截止、关闭、最终结果由服务端提示允许的动作 | 合成页面与契约通过；跨端真实 HTTP / 数据库集成待测试环境验证         |
| 适当权限工作台                                        | 建群审核、骨干审核、人工进群管理按服务器能力和每条记录动作；仅名单权限进入既有 `mode=view`                 | 403、权限撤回、修订冲突、重复点击和迟到响应合成用例通过              |
| 既有活动报名                                          | 保留报名状态、本人回执、修改作答、完整 16 类表单、复杂分支及五至六人成员组                                 | 既有表单与原生回归通过；真机未验证                                   |
| 活动 / 社区活动 / 骨干申请前后台恢复                  | 首次加载与重载被隐藏打断后恢复读取；隔离旧账号、旧页面响应；提交中返回仅 GET 确认，允许时保留未保存草稿    | 72 项实际 Page handler 合成生命周期用例通过；官方模拟器与真机未验证  |
| 登录 / 注册 / 重设密码                                | 沿用网站账号与邮箱验证；修正只认能力版本 1 的旧逻辑，读取服务器明确声明的能力                              | 版本 1/2/3、缺失能力、弱网重试合成用例通过；真实邮件和账号操作未执行 |
| 队伍核心 / 简介 / 荣誉三条新分支                      | 保留基线已有展示入口，等待父任务提供最终合同后适配                                                         | 本轮未新增团队 API、名单或推测未来接口                               |
| 订阅通知、原生内容创作与升推管理、骨干批次制作 / 导出 | 本轮未接入；既有网页工作台继续承担配置、制作与管理                                                         | 无订阅消息发送、平台权限申请、正式版本上传或审核提交                 |

队伍的 collection/read 合同已经出现；本轮继续等待核心最终公开 HTTP 与 profile/honor 合同。成员以服务端成员模型为唯一权威，骨干流程保持独立；未调用含内部 `overrideAccess` 的 member getter 生成公开名单。

## 契约与权限

骨干写操作继续使用 `/api/staff/batches/:id/application`：初次提交 POST、改稿 PATCH、撤回 POST `action=withdraw`、审核 POST `action=review`。修改及审核携带服务返回的 `revision`，作答携带 `version`；已撤回重提使用同一批次和修订号。成功后刷新本人能力；刷新失败保留已保存回执，并关闭动作等待用户重试。客户端不保存内部审核备注、请求键或审计历史。

必要的 JSON 兼容层包括：

| 路径 `/api/miniapp/...`                        | 作用                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET club`                                     | `currentStaffBatches` 与 `promotedContent` 的既有公开投影                        |
| `GET staff?page=`                              | 已发布的历史批次；窗口文字来自 `staffWindow`                                     |
| `GET staff/:id` / `?mode=review`               | 本人表单、回执与动作；授权审核队列调用已有 `readStaffApplications`               |
| `GET workbench`                                | 当前数据库身份的建群 / 骨干审核入口能力                                          |
| `GET/POST community/applications`              | 本人 / 授权审核队列；初次提交复用集合 hook，其他动作调用现有申请、决定与名片服务 |
| `GET/POST community/:id/join` / `?mode=manage` | 本人进度或授权人工处理队列；所有写入调用 `changeCommunityJoin`                   |

私有兼容请求重新读取用户当前状态与权限。响应使用 `private, no-store`；关系只返回编号，列表不带大二维码或关联用户邮箱。动作字段仅决定界面显示，所有写入仍由既有服务和集合 hook 校验。普通社群管理员不会因骨干入口获得候选答案权限。

二维码仍由 `chooseMedia → readImage → wx.request` 的 JSON 提交，限制 PNG/JPEG/WebP、2 MiB。仅申请兼容路径允许上限 3 MiB 的流式 JSON；身份与进群请求保留 32 KiB 门禁。客户端未引入新的 `wx.uploadFile` 路径。选图、预览、展示授权和确认均由用户主动点击；展示同意默认不勾选。失败保留编辑内容，确认框出现前锁定动作，账号变化清空私有数据并丢弃迟到回调；退出后迟到的私有图片写入会删除。

表单继续使用原生生成模块与 `templates/questionnaire.wxml`，声明 `X-Questionnaire-Version:3`。生成模块没有被修改；填答包含 text、textarea、single、multiple、select、number、date、time、rating、nps、ranking、matrix、matrixMultiple、blanks、group 和 description 共 16 类。原有简易制作器及高级表单跳转网页制作保持原边界，不会把高级表单转换为四题型。

## 报名页生命周期修复

独立复核在冻结的 `afc1ea3` 中复现 P2：已有回执成功加载后点击重试，新的 GET 未完成就隐藏并返回页面。旧实现没有使加载完成标记失效，因此没有第三次 GET；被废弃的旧响应也无法结束加载，三个入口均停在 `loading=true / info=null`。

`b2adf41` 在每次读取开始时使完成标记失效，隐藏时停止可见加载状态，重新显示时读取当前账号及当前页面的数据。读取结果必须同时匹配请求编号、账号和页面路径；退出、换账号、换页面或卸载会隔离迟到响应，失败可显式重试。正常离开已加载的问卷仍保留草稿，不额外读取。

提交锁持续到原写请求结束。请求在后台先结束或回到前台后才结束，均不会自动重发 POST/PATCH；后台不触发恢复 GET。返回前台后只读确认服务端状态：新回执直接显示，原记录编号与修订未变且服务端仍允许提交或修改时，才恢复同一账号、页面及会话上下文的未保存草稿。确认 GET 失败仍可重试。补充的后台先结束失败场景在最后修正前为 6 项失败，修正后全部通过。

以下冻结复现命令在三个入口上预期失败，分别断言实际 2 次 GET，而正常恢复应有 3 次；修复后的完整文件共 72 项通过。全部使用合成会话、延迟 Promise 和真实原生 Page handler，没有调用微信模拟器或线上接口。

```sh
MINIAPP_LIFECYCLE_REF=afc1ea3 pnpm exec vitest run tests/miniapp-signup-lifecycle.test.ts -t '已有回执 retry'
pnpm exec vitest run tests/miniapp-signup-lifecycle.test.ts
```

## 微信官方核验与设计选择

2026-10-12 已查询微信官方中英文文档。文档站直读返回 `non-retryable error`，容器 HTTPS 通道返回 CONNECT 403；没有用第三方总结替代当前平台条款。可读取的补充官方资料是微信 [`api-typings` 文档生成说明](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/README.md)，以及当日查询的官方仓库快照 `6092df9`（2026-09-01 更新）。这只能证明该快照中的 API 契约，不能证明平台后台配置或审核结果。

| 可读取的官方事实                                                                                                                                                                                                    | 本项目设计选择                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| request / download / upload 使用 HTTPS；下载成功回调仍需检查 HTTP 状态。[网络 API](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L22759) | 凭据请求固定 `https://home.thuzijing.top`；保留合法域名检查。媒体来源和重定向在平台复核。                          |
| `wx.login` 提供微信登录 code。[登录 API](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L26410)                                           | 本轮继续网站账号 JWT，没有新增微信身份绑定或读取 AppSecret。                                                       |
| 隐私辅助接口可选；自定义同意须关联真实授权按钮事件。[隐私 API](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L28784)                     | 主动选图前调用 `requirePrivacyAuthorize`；使用平台原生流程，不自建同意事件。拒绝不读图，可重试；缺少接口提示升级。 |
| `previewImage` 支持个人码长按识别；没有好友或进群结果。[图片 API](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L29961)                  | 名片预览零写入；好友与进群确认由人工操作。                                                                         |
| 订阅弹窗需要用户点击或支付回调触发。[订阅 API](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L30623)                                     | 本轮没有订阅模板、自动请求或真实消息发送。                                                                         |

以下官方平台页面已查询但正文未能实时读取，相关细则仍需人工复核：

- [网络能力 / 合法域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)：当前域名配置、主体条件、备案、端口、TLS 与重定向。
- [隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)：平台声明、实际资料字段和授权流程。
- [web-view](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)：主体能力、业务域名及外链要求。此客户端没有 web-view；外链由用户主动复制，平台可接受性未验证。
- [小程序平台运营规范](https://developers.weixin.qq.com/miniprogram/product/operation.html)：当前内容、联系名片及外链展示的审核条款。本轮不声称审核必过。

## 已执行证据

环境为 Linux、Node `24.19.0`、pnpm `11.25.0`；使用仓库锁文件安装，未创建或读取平台密钥。基线 CI 成功记录为 [V1 checks 38209674895](https://github.com/QShin21/zijingwebsite/actions/runs/38209674895)。上一版 `afc1ea3b0f56d92c820307d94dc944f722da4c96` 的 [CI 38215530655](https://github.com/QShin21/zijingwebsite/actions/runs/38215530655) 已于 2026-10-12 07:22:47 UTC 完成并成功；这项记录不包含后续生命周期修复。

- **253 项 / 13 文件合成测试通过**：9 份小程序测试 184 项，加 4 份问卷逻辑测试 69 项。API 使用 mock，页面 handler 在 Node VM 中实际执行；没有请求生产数据或保存真实申请。
- `pnpm miniapp:check` 通过：**17 页面、105 文件、259536 字节**，合法域名检查开启；生成问卷与服务器源文件保持一致。
- `pnpm typecheck`、`pnpm lint`、`git diff --check` 通过。
- 该环境没有 `wechat-devtools`、`wcc`、`wcsc` 命令，未配置工具路径或服务端口；本轮未执行官方编译、官方模拟器、开发版上传、真机或微信审核。

可复现命令：

```sh
pnpm exec vitest run tests/miniapp.test.ts tests/miniapp-startup.test.ts tests/miniapp-questionnaire.test.ts tests/miniapp-api.test.ts tests/miniapp-club-api.test.ts tests/miniapp-staff-flows.test.ts tests/miniapp-community-flows.test.ts tests/miniapp-content-flows.test.ts tests/miniapp-signup-lifecycle.test.ts tests/questionnaire-schema.test.ts tests/questionnaire-flow.test.ts tests/questionnaire-group.test.ts tests/questionnaire-platform.test.ts
pnpm miniapp:check
pnpm typecheck
pnpm lint
git diff --check
```

## 后续可执行检查点

1. 在已有隔离测试环境接入本分支兼容补丁；沿用基线业务服务和已审查的建群 / 骨干模型。验证相同合成账号从网页和小程序看到同一申请编号及修订；普通管理员请求他人骨干答案或审核队列应被服务端拒绝。本轮没有部署兼容接口。
2. 已有开发权限者导入 `miniprogram`，保持 `urlCheck:true`，记录开发者工具与基础库版本并执行官方编译。先在隔离测试服务核对 JSON、403、409、弱网重试及分页；不要用关闭域名检查作为联网成功证据。
3. 在公众平台只读核对 request、downloadFile、现有 uploadFile 和业务域名列表。确认 `home.thuzijing.top` 及实际媒体域名、TLS、重定向和外链规则，记录当前声明，不申请新权限或创建密钥。
4. 用合成资料核对隐私声明覆盖姓名、学校、联系资料、申请答案和二维码；测试首次选图、同意、拒绝、取消与重试。名片展示授权和平台隐私同意分别验证。
5. 真机用合成图片检查名片预览、长按识码、返回、连续点击和慢网。预览不应产生进群写请求；主动报告与管理员人工确认分开验证。不添加真实管理员，不写生产群记录。
6. 在隔离测试服务给 GET/POST/PATCH 注入延迟，分别验证活动、社区活动和骨干申请的首次加载、已有回执重载、隐藏再显示、退出换账号及迟到成功/失败。提交只发一次写请求；返回后的恢复只能读取，原记录未变时保留草稿。分别覆盖写请求在后台先完成、返回后才完成和确认 GET 失败后显式重试。
7. 记录真实编译与真机结果后再交给父任务决定后续发布范围；队伍三条分支收到最终合同后另做适配。本轮不提交审核、不上传正式版本、不发送订阅消息。

逐项执行记录见 [miniapp-club-flows-20261012.json](evidence/miniapp-club-flows-20261012.json)。
