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
