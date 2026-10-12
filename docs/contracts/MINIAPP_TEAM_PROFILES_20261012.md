# 小程序队员简介 HTTP 消费合同 · 2026-10-12

原生入口为 `pages/team-profiles/index?team=<队伍ID>`。实现范围为页面、`lib/team-profile.js`、合成 Page/SDK 测试及本文；未新增名单、成员权限、服务端代理或业务状态机。

后端参考精确提交为 [`3ba056c3dde350b51f28ea72792fe17d54e96b84`](https://github.com/QShin21/zijingwebsite/commit/3ba056c3dde350b51f28ea72792fe17d54e96b84)。已读取该提交的真实 `api/team-profiles/[teamID]/route.ts`、`team-profiles-model.ts`、读取/保存服务、React panel 和 `docs/TEAM_PROFILES.md`。本原生切片没有引入该后端、集合、迁移或密钥；当前测试请求使用合成 HTTP 回应，后端与原生页面的真实联测仍待总集成者完成。网页分支的数据库/E2E/CI 记录不能替代本切片的联测证据。

## 精确读写

`GET /api/team-profiles/:teamID` 要求网站账号 JWT，返回：

```ts
{
  profiles: {id, displayName, position, biography, avatar}[],
  own: {
    eligible: boolean,
    membershipVersion: string | null,
    profile: {displayName, position, biography, avatar, visible, revision} | null
  }
}
```

GET 原文字保持原样。公开行与本人资料采用字段白名单；原始用户、成员关系、答案、备注及额外字段不进入页面。编辑资格只取当前服务端 `own.eligible`，客户端角色、旧名单与账号 `teams` 不授予编辑能力。`membershipVersion`、revision、完整头像 data URI 仅保存在页面实例内存，不进入 `setData`、本地持久化或路由参数。视图仅接收文字、展示选择与受控私有本地图片路径。

`PUT /api/team-profiles/:teamID` 继续使用原路径，精确输入如下；首次创建的 revision 是 **null**：

```ts
{
  revision: number | null,
  membershipVersion: "首次初始化编辑器时取得的原周期凭据",
  profile: {displayName, position, biography, avatar, visible: boolean}
}
```

请求调用现有 `http.request`，使用 `{method:'PUT',required:true,raw:true,siteWrite:true}`。共享 HTTP 在显式认证写入时添加固定 `Origin=config.origin`，并仅保留 409 的已知 `PROFILE_PERIOD_CHANGED` 错误码；GET 不添加 Origin。原服务再次验证实时账号、成员周期、revision、简介内容和图片，不接受客户端资格事实。响应为 `{profile:本人回执}`，随后仅 GET 刷新展示名单。没有自动 PUT 重试。

## 周期与异步保护

- 编辑器保留首次取得的周期凭据和修订；普通前台/后台 GET 刷新名单不会把旧已勾选草稿换绑新周期。
- 409 `PROFILE_PERIOD_CHANGED`、保存响应后 GET 发现周期变化或当前资格失效，均锁住编辑并立即把本页展示选择置为 false。原输入可继续预览。
- 用户明确点击“重新加载已保存资料”后才重新初始化凭据。存在未保存输入时先确认替换；周期锁定后的重载默认隐藏，用户须再次主动勾选展示才会发出新周期的公开保存。
- 普通 revision 409 保留输入与预览，暂停保存直到明确重新加载并核对；弱网失败保留草稿，用户明确确认保存时才重试。
- write、file、modal 各有进行中锁，跨 hide 和账号/路由变化保留到 finally。迟到结果用账号、队伍、页面 context、可见 epoch 守卫拒绝，卸载后不对账。
- 后台写入不发 GET 或额外 PUT；返回前台后只 GET 对账。服务端当前记录修订未变时保留未保存输入，记录已变时展示服务端确认资料；新周期始终先锁定并取消本页展示选择。
- 同账号、同页面 context、同队伍的迟到成功回执保留精确 saved/revision，仅存实例内存。恢复 GET 失败时展示已确认保存资料并进入待核对状态；成功 GET 核对当前周期及不早于确认结果的修订之前，编辑、选图和保存都关闭。迟到失败保留原输入，也须成功 GET 后才继续保存。账号/路由变化与卸载不保留旧回执。
- 共享 HTTP 的迟到 401 仅在请求捕获的凭据仍等于当前凭据时清会话，避免旧请求清掉后登录的账号。

## 头像与微信资料核验

本人明确点击选图后才执行 `privacy.authorize()` → `files.choose(1)` → `files.readImage(path, 2*1024*1024)`。拒绝、取消、超限或读取失败可重试，不覆盖原头像或自动保存。PNG/JPEG/WebP data URI 是当前网站简介合同；**2 MiB 与这些格式属于网站产品限制**。实际字节解码、静态图片判断、像素限制及去元数据重编码仍由原服务完成，客户端不声称已完成相同处理。展示使用私有临时文件；图片 epoch 失效后清理晚到写入，仅删除本页受控前缀和允许扩展名。

2026-10-12 再次查询并尝试读取微信官方 [wx.request](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html)、[wx.requirePrivacyAuthorize](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/privacy/wx.requirePrivacyAuthorize.html)、[wx.chooseMedia](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.html) 和 [文件读取](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readFile.html) 页面。官网正文仍被环境拒绝（non-retryable），搜索未提供可核验的微信官方正文；没有采用其他平台或第三方概括。

可读取的一手补充为腾讯官方 [`wechat-miniprogram/api-typings` 固定提交的 API 定义](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts)。其 [README](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/README.md) 说明 API 定义随官方文档生成。该声明支持：request 可设置 header 且不能设置 Referer；chooseMedia 可限图片并返回本地临时文件；readFile 默认可读取 ArrayBuffer；隐私辅助接口可接收成功/失败回调，requirePrivacyAuthorize 与 openPrivacyContract 需要 2.32.3。官方资料把前者列为可选辅助接口；本页面选择在主动选图前使用它，并仅由主动点击打开隐私指引。

**设计选择与未核验项：**固定 Origin 是兼容原网站写接口的客户端选择，合成测试只能验证传给 wx.request 的参数，不能证明微信实际传递该 header。真实 SDK 的 Origin、HTTPS 证书及合法域名登记、相册/相机隐私指引项、平台隐私弹窗、客户端兼容性、本地头像显示与清理均未通过开发者工具或真机验证。本页没有 web-view、二维码进群判定或订阅消息调用，不据此声明其他页面或微信审核通过。

## 实际验收与后续步骤

`tests/miniapp-team-profiles.test.ts` 直接在 Node VM 执行真实 Page、简介 consumer、http/session/files/privacy/navigation 模块，以合成 wx 回调驱动；没有 mock 页面方法，也没有连接 Payload、真实账号或数据库。70 项覆盖周期重放、null revision、普通冲突、八种后台写入时序、迟到 401、账号/路由/hide/unload、独立操作锁、主动授权及接口缺失、2 MiB 文件限制、晚到本地写入和最小数据投影。此范围是原生消费者合成测试，未启动微信模拟器，未执行网页服务 HTTP 或微信审核。

独立复核发现“旧页 PUT 已确认 rev4，hide/show 后 GET 失败，用户再点保存仍发送 rev3”的边界。追加五条回归，修前 0 通过/5 失败，修后五条通过；覆盖先 show/先完成、GET 失败后同周期/新周期重读及迟到失败草稿。临时合成报告为 `/tmp/zijing-miniapp-profile-ack-before-20261012.json`、`/tmp/zijing-miniapp-profile-ack-after-20261012.json`。这是用户再次点击导致的旧 PUT，未称为客户端自动重试。

总集成后按以下步骤验证，仅用隔离合成账号和资料：

1. 引入精确简介后端及其已审迁移依赖后，在隔离服务确认 GET/PUT 合同与网页原周期回归；原生分支不自行增加服务器接口。
2. 在已授权微信开发者工具项目读取并核对现有合法域名/隐私配置；保持域名校验开启。核实实际 HTTPS GET 与 PUT、Authorization 和 Origin，确认成功响应及原服务同源检查。
3. 在 iOS/Android 真机验证主动选图前授权、拒绝后重试、相册/相机取消、静态 PNG/JPEG/WebP、超限、头像移除与保存后的服务端重编码；切后台/退出登录后检查受控临时文件清理。
4. 用合成成员离队/重新录取制造新周期：旧页 checked 保存应被拒绝或刷新后锁定；重载默认隐藏，新一次主动勾选才能公开。再验证弱网、账号切换、路由变化及重复点击无额外 PUT。

没有申请新平台权限、读取密钥、正式上传、提交审核、发送订阅消息、部署或生产操作。授权/工具缺失时以上步骤保留为未验证，由拥有现有项目访问权的验证者执行。
