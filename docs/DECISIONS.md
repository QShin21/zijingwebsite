# 决策记录

1. 采用 Next 16.3.5 / Payload 3.90.1；npm 实际 peer 要求 Next >=16.3.3 <17。文档 https://payloadcms.com/docs/getting-started/installation 。
2. Local API 默认跳过权限（https://payloadcms.com/docs/local-api/overview），所有公开读取显式关闭 overrideAccess，depth:0，匿名身份。
3. 使用版本草稿保护已发布内容，发布者专属发布权限；公开页动态渲染，时间窗口逐请求计算。
4. 本地 PostgreSQL 使用项目内嵌二进制；生产使用独立 PostgreSQL 容器。Docker 缺失不阻止应用开发。
5. 未提供真实内容：只初始化名称与栏目配置，演示显式导入。Sites 技能限定 Sites 工程，本项目按指定 Next/Payload 架构实施，不注册或发布 Sites。
