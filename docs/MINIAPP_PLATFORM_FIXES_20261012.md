# 原生小程序平台缺项收尾 · 2026-10-12

代码收尾已完成，独立分支为 `codex/miniapp-platform-fixes-20261012`，从已部署来源 `6f862c7bb876db658ab7c961bf55979cfa276482` 开始。原生代码来源 `e3a935c33d4a79695fa656cb51a0977a72117465`。保留 0.3.1、25 页、15 种问卷加段落共 16 类、复杂分支与 5–6 人组队，复用网站现有状态、权限及审批投影。

本轮仅提交工作分支，没有更新 main/littleapp/recovery、PR、合并、部署、生产数据库或微信上传/审核。上一份 6f862c7 导入包是修复前历史来源，不能用来验收本轮改稿及首次授权收尾。

## 精确提交与最小网站补丁

按下列顺序供父任务整合；本线程没有执行目标分支 cherry-pick。

```sh
git cherry-pick 46a750699e6189bae2770d210abb93d01bba152c
git cherry-pick e3a935c33d4a79695fa656cb51a0977a72117465
```

- `46a7506`：网站兼容。只有活动/社区活动报名、骨干申请两条原有路由各加一个 `POST body.action === 'edit'` 分支，直接调用原 PATCH 的 `updateSignupAnswers` / `changeStaffApplication('edit')`，并增加 19 项真实 HTTP/JWT/SQL 回归。原 PATCH、普通 POST、PUT、GET、当前身份授权、表单版本、答案修订及截止规则保持。
- `e3a935c`：原生改稿统一使用 POST；仅修改既有回执时发送 `action:'edit'`，创建及撤回后重提保留原提交合同；非法请求方法在 SDK 前拒绝。增加已发布网站正文与微信平台指引分开显示的隐私组件、全局单次注册、正式按钮的同意与拒绝、待结束 SDK 请求归属锁、取消/页面/账号守卫及对应测试。

**需要上述网站小补丁先在父任务获准的服务环境整合。** 只导入原生包不能让尚未整合该补丁的服务提供 POST 改稿。没有增加团队 API、修改业务服务、collection、迁移或数据库状态机。

## 隐私行为

名片、队员头像、荣誉图片和视频主动选择入口共用 `privacy-consent`。先匿名读取 CMS 已发布 `key=privacy` 的实际正文，同时查询微信平台当前指引名。空、草稿、仅摘要、仅图片、空白/不可见字符正文、读取失败均不能启动隐私授权或媒体选择；有可执行的拒绝返回、正文重试和平台指引重开入口。网站文案跳过客户端品牌替换，避免改写真实运营者或联系文字。

首次授权等 SDK `onNeedPrivacyAuthorization` 后，用户打开独立平台指引，再轻触 `open-type="agreePrivacyAuthorization"` 的按钮，实际 `bindagreeprivacyauthorization` 事件才提交 `resolve({event:'agree',buttonId})`。打开文档不等于同意。普通离页、卸载、换账号与取消会否决旧操作；已发起而未结束的 SDK 调用保留归属直到真正 success/fail，迟到事件不能附到新操作。平台指引一次访问支持 success/hide 的两种顺序，隐藏时仍不能同意。若打开平台指引使原表单生命周期变化，继续保留原守卫，返回后应重新明确选择媒体，不会自动恢复旧选择。

SDK 已同意者仍经过已发布正文非空门槛。`getPrivacySetting:false` 本身不证明后台采集声明完整。[草案](MINIAPP_PRIVACY_DRAFT_20261012.md)只列三组需负责人核定的事实；本轮没有将草案放到 CMS 或代为发布/同意。

## 各流程状态

| 流程 | 已实现/保留的行为 | 本轮证据与外部检查 |
| --- | --- | --- |
| 活动、社区活动报名及改稿 | POST edit 保留本人编号、form version 与 receipt revision；创建无 edit；无 GET 写入或自动重发 | 真实 Page+HTTP SDK 方法回归及 12 项真实活动 HTTP/JWT/SQL；微信实际请求待验证 |
| 统一骨干申请 | 同一份回执供各入口读取，保留本人状态、改稿、撤回、重提与有权审核；普通管理员无新增私有答案权限 | 31 项原生、相关服务投影回归及 7 项真实骨干 HTTP/JWT/SQL；平台现场待验证 |
| 普通人工入社与申请建群 | 授权管理员名片、人工加好友拉群、意向和回执；点击二维码不算已入群 | 原生 community 30+34 项回归；人工群处理及名片真机展示待验证 |
| 队伍申请与工作台 | 复用已有团队合同、本人历史回执和服务端动作；无新团队 API | 原生申请 72、工作台 73、API 消费者 21 项回归；本轮未重跑旧队伍 SQL/网页验收 |
| 简介与头像 | 保留周期、主动公开授权和本人操作；头像使用新隐私入口 | 91 项原生回归；首次授权 SDK、头像真机选择与平台配置待验证 |
| 荣誉投稿、审核与媒体 | 保留私有草稿/批准投影、退回重提、撤回、保存后独立 MP4 上传；媒体使用新隐私入口 | 工作台 62、媒体 111、公开消费 12 项回归及真实媒体消费者隐私组合用例；本轮未重跑旧荣誉 HTTP/网页验收 |
| 社群/社团活动、通知、风采 | 既有栏目与已审批投影消费者保留 | content/community 合成回归；真实订阅推送未实现/未发送，本轮不申请权限 |
| 首次隐私告知/拒绝/同意 | 网站正文与微信平台指引分开；空正文关闭；正式按钮同意，取消和旧回调受控 | 41 项真实 Component/辅助层/CMS/HTTP/媒体消费者合成用例；独立 14 项复核；正文核定发布与平台/真机待验证 |

## 实际执行证据

[机器证据](evidence/miniapp-platform-fixes-20261012.json)绑定完整代码 SHA 与 146 份原生源摘要；[官方约束和数据事实](evidence/miniapp-privacy-facts-20261012.json)保留出处及文档访问限制。

- 全部 22 个无需数据库的 miniapp 测试文件 **799/799** 通过，含新增 28 项方法/改稿及 41 项隐私；原用例保留，没有将完整问卷降为少数题型。媒体/简介/荣誉/骨干原业务断言另有逐项保留核对。
- 新增真实回环 HTTP socket 分派到实际 route exports，只有 CMS locator mock，JWT/Payload/ACL/SQL 全实，**19/19** 通过：同编号改稿、5→6 人、旧 version/revision 409、跨申请人、停用账号、截止、GET 只读、原 PATCH、普通提交幂等及审核撤权。未声称覆盖 Next 全框架/反向代理或微信 SDK。
- 全仓 ESLint、`tsc --noEmit --incremental false`、diff 检查、实际 miniapp:check 通过：25 页/146 源文件/474072 字节、域名校验开启、原生依赖 0。
- 从原有微信官方发布 `miniprogram-compiler@0.2.3` 验证原始 wcc/wcsc 字节后，当前全部 **29 WXML/27 WXSS** 编译成功，stderr 0、系统调用网络 0、未执行编译产物。该版本是历史编译工具版本；客户端仍为 0.3.1。它不能替代现代 DevTools 3.16、基础库运行、模拟器、真机或审核。
- 独占 `/tmp` 合成 PG17.10 应用既有 17 迁移，测试记录及审计清理为 0；数据库已停止并移除。空 dotenv、静态合成测试凭据、邮件/S3 关闭，没有读真实密钥或连接生产。

这是本轮定向验证；未将已成功的基线 CI 当作新 SHA 的全量 CI、构建或部署成功。新分支的 CI 结果单独报告。

## 官方事实与本项目选择

查询了当前微信官方 `api-typings@5.2.3`，固定提交 `6092df9100c73b84e140c20b9a42a8e8799e0660`；官方 npm 包与该 API 文件摘要一致。开发平台 HTML 部分正文仍因访问受限不可读取，按证据逐项记录，没有凭记忆补成确定规则。

| 主题 | 文档事实或源码事实 | 本项目选择/待现场核对 |
| --- | --- | --- |
| HTTP 方法 | 官方 [RequestOption](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L10863)声明 8 个方法，没有 PATCH | 用等价明确 POST edit；不推断所有未测试客户端的 PATCH 实际行为 |
| 隐私授权 | [onNeed](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L28784)说明 pending、真实按钮检查、agree/disagree 和覆盖式监听；最低基础库 2.32.3 | 网站正文非空及先打开平台指引是本项目门槛；平台配置完整性单独核对 |
| 已同意与打开协议 | [requirePrivacyAuthorize](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L30742)已同意立即 success；[openPrivacyContract](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L29580)打开平台协议 | 不把打开文档或已授权 success 当成网站正文已发布、后台勾选齐全或系统相册权限已批准 |
| 域名、登录、上传/下载 | 官方 HTTPS request、multipart POST uploadFile、GET downloadFile 与 wx.login 获取 code 的注释已读；实际源码用网站 JWT，媒体同源路径受限 | 现有 request/uploadFile/downloadFile 合法域名、TLS/重定向、实际媒体响应、网站账号登录、官方工具登录分别现场验收；无新增 OpenID 绑定或密钥 |
| 二维码、外链、订阅 | 当前源码明确展示服务已授权名片，外链复制后由用户打开，无自动加群；无订阅消息调用 | 展示和剪贴板是用户主动操作；不以二维码轻触确认入群，不新增平台权限或发送订阅消息，不作审核承诺 |

## 下一检查点

父任务先按精确提交整合网站兼容与原生代码，再由负责人核定并发布完整正文。后续只导入对应代码的包做官方编译/模拟器及合成会话真机检查，按[可执行检查单](MINIAPP_PLATFORM_CHECKLIST_20261012.md)逐项记录。服务兼容、正文及既有平台配置未满足时，不把该包交给用户测试线上写入。

修复后导入包 `zijing-miniapp-import-e3a935c-20261012.zip`：209754 字节、152 项，SHA256 `2fd3a91f2ca0eec46f62faeff67eed4df9e16506f3451a5a05c5656b1102620a`；147 个源码/配置项与 Git e3a935c 逐字相同，ZIP CRC 通过。已更新原 Library 条目为版本1并保留原版本；库内标识不写入仓库。见[打包证据](evidence/miniapp-platform-import-20261012.json)及[导入说明](MINIAPP_IMPORT_PLATFORM_FIXES_20261012.md)。

可以使用本次文档输入在新目的地复现导入包；同一文件存在时生成器会拒绝覆盖：

```sh
python3 scripts/package-miniapp.py \
  --source e3a935c33d4a79695fa656cb51a0977a72117465 \
  --output /tmp/zijing-miniapp-import-e3a935c-rebuilt.zip \
  --readme docs/MINIAPP_IMPORT_PLATFORM_FIXES_20261012.md \
  --checklist docs/MINIAPP_PLATFORM_CHECKLIST_20261012.md \
  --evidence docs/evidence/miniapp-platform-fixes-20261012.json \
  --privacy-draft docs/MINIAPP_PRIVACY_DRAFT_20261012.md
```
