# new 分支：选座整合与注册邮箱排版

## 来源与实现
- main 源功能提交：`d3a1446ee0677876cdea2e833a24d479ec047c8f`；核查时 main HEAD 为 `7f56e08112da9eac4627c91f1ecef1b971922ed6`（部署记录）。33 个来源文件逐一校验 Git blob SHA，无不一致。
- 目标基线：new `90c7c8dd7b529c0b889dd9d94d93b355731e0995`。未整体覆盖或合并 main 的旧前端。
- 网站与小程序选座实现：Claude Code Opus 5.5 max；保留 V3 电竞视觉、双主题、实际 V2 活动入口。后端适配：GPT-6 Astra high。
- 注册邮箱两行样式由独立 Claude Code Opus 5.5 max 最小请求生成并原样应用；仅改 WXSS，账号前缀输入占第一行，后缀选择占第二行，不改 WXML/JS 组合或验证逻辑。
- 长会话收尾曾失去执行句柄，保存成果未覆盖；有界恢复未返回最终报告。最终依据磁盘代码、检查与构建判断，不把模型未返回的声明当完成证据。

## 功能与文件索引
- `src/components/activity-pages/ActivitySeating.tsx`：381 座地图、缩放/键盘、选择摘要、手机号/凭证、本人申请状态。
- `SeatWorkbench.tsx`、`ActivitySeating.module.css`、`seat-request.ts`：审核/启停工作台、双主题展示、请求错误与状态处理。
- `src/components/v2/EventDetail.tsx`：真实站点活动及社群活动详情入口，不仅修改已不使用的旧组件。
- `src/app/(frontend)/activities/[kind]/[id]/seating/page.tsx`：鉴权审核页。
- `miniprogram/src/pages/activity-seating/*`：原生选座与审核页；`pages/detail/*`、`lib/navigation.js`、`app.json`：详情入口、深链和路由注册。
- `miniprogram/src/pages/auth/index.wxss`：注册邮箱两行排版。用户截图仅用于内部参考，未进入仓库。
- `src/lib/activity-seating*.ts`、`site-request.ts` 与三条 seating/proofs API：与 main 同源接口，座位并发/截止/身份/凭证授权。详见 `ACTIVITY_SEATING_NEW_BACKEND_20261112.md`。
- `src/migrations/20261112_000000_activity_seating.ts`、迁移注册、健康检查和兼容脚本：新增表与无损迁移核验。
- `tests/activity-seating.test.ts`、`tests/health-ready.test.ts`：后端功能与就绪检查；`tests/rebuild-native.test.ts`：新路由覆盖。

## 本次必要验证
- 后端及兼容验证：15 文件、242 项通过；72 张业务表原字段计数及 SHA256 保持一致。合成记录中的选座/凭证字节/审核可读，已包含排队等待座位锁跨过截止时间的边界。
- TypeScript、全仓 ESLint、diff 检查通过。
- 小程序静态检查：29 页、199 文件、921904 字节；域名检查开启。32 项共享设计输出一致性通过。
- 4 组主题/令牌/原生路由/WXML 绑定测试：78 项通过。
- 合成 VM/源码快速核查：11 个断言通过，含邮箱两行及绑定保留、381 座、已占位不可选、最多10座、换号清除账号私密状态。
- 隔离合成 PostgreSQL 迁移及生产构建通过，BUILD_ID `JW8UJHtSHRD28t336BJdr`。构建后唯一产品改动为小程序邮箱 WXSS，不影响网页构建。

## 边界
按用户催促优先完成必要检查，没有等待新增大范围截图/全量套件。此次没有完成选座真实浏览器动态交互、微信开发者工具或真机验收，也没有重跑全部历史套件。上一 V3 全量基线的40项既有失败仍记录在原验证文档，本次不能声称全仓全绿或这些旧失败已修复。没有操作生产数据库、部署网站、上传小程序或修改 main；代码仅推 new。
