# 决策记录

1. 采用 Next 16.3.5 / Payload 3.90.1；npm 实际 peer 要求 Next >=16.3.3 <17。文档 https://payloadcms.com/docs/getting-started/installation 。
2. Local API 默认跳过权限（https://payloadcms.com/docs/local-api/overview），所有公开读取显式关闭 overrideAccess，depth:0，匿名身份。
3. 使用版本草稿保护已发布内容，发布者专属发布权限；公开页动态渲染，时间窗口逐请求计算。
4. 本地 PostgreSQL 使用项目内嵌二进制；生产使用独立 PostgreSQL 容器。Docker 缺失不阻止应用开发。
5. 未提供真实内容：只初始化名称与栏目配置，演示显式导入。Sites 技能限定 Sites 工程，本项目按指定 Next/Payload 架构实施，不注册或发布 Sites。
6. 最终固定依赖详见 package.json/pnpm-lock.yaml。React 19.2.4、TypeScript 5.9.3、Tailwind 4.1.18。图片处理升级 sharp 0.35.4；锁定 DOMPurify 3.4.13、esbuild 0.28.2，实际生产依赖审计0项。所有 Payload 包统一3.90.1；pnpm peers check 无冲突。
7. ESLint 9 已停止维护，Next lint预设部分插件尚不支持10；改用受维护 ESLint10 + typescript-eslint8，前台无障碍由真实 Playwright/axe 检查。保留上游 drizzle-kit 的弃用依赖警告，不在项目中使用其开发服务器。
8. Windows 管理员会被 postgres.exe 拒绝；使用官方 pg_ctl 的受限启动方式，无需建立系统用户。内嵌开发包升级到17.10.0-beta.17（提供稳定PostgreSQL17.10二进制，包装器版本带beta）；生产镜像使用17.11，备份客户端17.11。首次迁移/恢复在17.6运行，随后17.10重启持久化检查通过。
9. 公开HTTP状态优先于整页loading边界：移除导致404/308提前流式发送200的整页loading，导航提供useLinkStatus反馈，元数据先解析；实际生产构建验证404/308。
10. 使用 server-only SERVER_URL 作为运行时origin，兼容 NEXT_PUBLIC_SERVER_URL；Compose自动填充，避免同一镜像切换环境后规范地址/CSRF仍停留在构建域名。robots/sitemap均动态，APP_ENV与NODE_ENV分开。
11. 未安装Docker且标准安装路径不存在，容器构建/持久化验收记为受阻。原生PostgreSQL重启验证单独记录，不替代容器验收。无真实微信设备、SMTP、对象存储、异机目的地，相关集成不标通过。
12. UI V2 使用深墨色、紫荆紫和少量浅绿的编辑式设计；原创 SVG Z 为界面装饰，后台图片优先。无外部字体、图库和动画依赖；不解释为学校或社团官方标志。
13. 保留 CMS 与业务访问边界，改版集中在公开呈现层。首页精选失效回退到公开内容；已发布活动可继续作为回顾入口。禁止为填满页面编造正式内容。
14. 手机导航采用原生 details，增强 Escape、点击外部与路由关闭；确保没有 JavaScript 时仍可打开。保留第9条的 HTTP 状态策略，不增加全页 loading 边界。
15. 本轮本地容器无外部 DNS，完整执行链路移到 GitHub Actions；离线组件布局测试与真实 CI 验证分别记录。安装许可只新增明确缺失的 @embedded-postgres/linux-x64，不放开所有依赖构建脚本。
16. 2026-09-20 用户已授权仓库修改与推送；工作分支验证通过后更新 main，不改写历史。生产部署、DNS、购买和破坏性生产操作继续独立授权。
