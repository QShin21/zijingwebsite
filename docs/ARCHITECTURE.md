# 工程架构

单仓库模块化单体：Next App Router 提供服务端公开页面；`(payload)` 路由组挂载 Payload 后台和 REST；PostgreSQL 由 Payload 适配器管理。无第二套 ORM。Tailwind 4 + CSS 变量维护界面，公开页面几乎无需业务客户端 JS。

目录：`collections/` 内容及钩子；`globals/` 站点首页；`access/` 统一角色与对象查询；`lib/content.ts` 匿名公开查询与字段投影；`lib/rules.ts` 时区、状态、协议校验；`migrations/` 模型迁移；`scripts/` 运维工具。

公开查询固定 `user:null, overrideAccess:false, draft:false, depth:0`，不继承管理员 cookie。公开字段由明确投影控制。关联内容再次按匿名权限查询；不直接展开内部对象。后台 REST 使用 Payload 鉴权。GraphQL 未挂载。

公开页 `force-dynamic`：保存、发布、撤下后下一次请求立即反映，截止状态逐请求计算，无发布者/匿名缓存混用。预览需登录并受对象权限限制，响应为 private/no-store/noindex。首页模块去重，空数据隐藏；手工推荐仍需公开权限；归档、取消和结束活动不进入首页推荐。

版本：草稿与发布记录由 Payload versions 维护。普通编辑即使省略 draft 参数也被强制草稿保存；伪造 published 明确拒绝。恢复历史版本仅限发布负责人/管理员，恢复操作仍经业务钩子与验证。重要操作追加审计；内部特权仅集中用于受控初始化、演示、审计、重定向和运维。

安全：成熟 CMS 密码/会话；5 次登录失败锁定 10 分钟；受信任 CSRF origin；CSP 每请求 nonce，禁止对象与外部脚本，后台内联样式获准；正文白名单；HTTPS 链接协议验证；PNG/JPEG/WebP 实际解码和像素/体积限制。没有 SMTP 时禁止输出重置令牌。跨站跟踪未启用。

本地文件与 S3 均经 Payload storage 配置。S3 需要独立公开媒体桶；不用于私人附件。SQLite/内存库不参与本工程验收。
