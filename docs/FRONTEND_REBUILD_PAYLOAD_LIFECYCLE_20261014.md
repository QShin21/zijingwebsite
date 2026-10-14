# Astra · 浏览器测试 Payload 生命周期修复

基于 `new@9279d6f1fcd452e0e4e62216d62058bd6ddc1244`，由 `gpt-6-astra max` 完成最小夹具修复。本轮仅改变两个 E2E 套件的实例获取，新增专用 helper 和一项真实 PostgreSQL 回归；产品源码、权限、数据库结构、依赖、原断言及清理均保持。只正常提交推送 `new`，保护分支仍为 `e366f3c6538e6c63c9f13fc183e26c32ce58cf11`。

## 根因和修复

安装的 Payload 3.90.1 在 `getPayload` 内按 `options.key ?? 'default'` 保存实例。`destroy()` 没有移除缓存；安装的 Drizzle 适配器销毁时清空 schema、tables、drizzle 并重设初始化 Promise。它没有结束底层 pg pool，不能将此故障描述为两个独立实例共用一个已关闭的连接池。

原 `rebuild-activity` 和 `site` 都取默认缓存，前者在 afterAll 销毁后，后者拿到同一失效对象。新实例每次通过 `config.db.init` 创建独立适配器，随后创建独立 `pg.Pool`；复用同一配置对象并不使这些实例共享连接池。

- `tests/e2e/payload-fixture.ts` 为两个套件提供固定键 `e2e-rebuild-activity`、`e2e-site`。
- 两份 spec 只改导入与实例获取调用；归一化这两处后，其余字节与基线完全相同，包括原 afterAll 删除、destroy、业务断言、超时和重试。
- `tests/e2e-payload-lifecycle.test.ts` 复用实际 helper 和同一配置，先读取活动实例并销毁，再验证站点实例真实 count/create；断言三个 Payload、适配器和连接池均互异。站点销毁后，默认实例仍能读取刚创建的合成用户。finally 删除该用户及其审计记录并销毁本测试实例。

没有改动其他使用默认实例的套件，也没有修改 Payload 依赖或绕过业务规则。新增回归位于 Playwright testDir 之外，原 E2E 仍为126项。

## 本轮实际验证

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| 真实 PG 失败对照 | 1失败，符合对照预期 | 只在新隔离 contracts/app 临时移除 helper 的 key；site.count 在1.627秒复现 `Cannot read properties of undefined (reading 'id')`。原失败日志保留 |
| 恢复修复后的同一回归 | 1/1通过、exit0 | 用真实合成 PG55617，1.668秒；无 Payload/PG mock，包含读写及清理 |
| 四文件定向 ESLint、diff检查 | 通过 | 未修改或放宽规则 |
| 新隔离优化构建及类型检查 | 通过、exit0 | `next build --webpack`，08:36:00–08:37:33 UTC，类型检查17.2秒；新 BUILD_ID `2Z7rxMMAeA16zLPDrP9fg` |
| E2E 收集 | 126项、28文件、exit0 | 仅 `--list`，没有执行顺序组合或全量浏览器测试 |
| 输入冻结 | 628文件一致 | 根工作区、新快照、构建 app、回归 app 逐字节一致；500个非测试输入与上轮 Sol 相同 |

构建打印 `Compiled with warnings in 60s`，未展开具体警告正文；完整日志保留，不宣称零警告。本轮没有重新执行完整 Vitest、两文件 E2E 或126项 E2E；新增单项通过不替代正式独立验收。上轮主 E2E 的104通过、1失败、21跳过继续保留在 [Sol终态报告](FRONTEND_REBUILD_SOL_FINAL_ACCEPTANCE_20261014.md)。

## Sol 接续环境与命令

当前精确测试快照为 `/workspace/astra-lifecycle-qa`，browser app 为其 `.data/rebuild-qa-20261013/browser/app`。新构建位于该 app 的 `.next`，没有启动为新服务器。原3373服务继续使用 BUILD_ID `0V_1ao2PM56qrzXsn8W8G`；本轮逐文件核对其500个非测试输入与修复后根工作区完全一致，故下一轮可以使用新测试快照连接该服务，无需重构建或覆盖旧app。

非测试输入摘要为 `be98b4eeb20534ab3f65f69919fec05482a8520ce23a5c4a0c3c65a0e5f463ea`，算法沿用前轮按文件顺序的紧凑 UTF-8 JSON SHA256。完整628输入见 [清单](evidence/frontend-rebuild-payload-lifecycle-inputs-20261014.json)。合成用户夹具从原已运行的 browser profile 逐字节复制到新 profile，SHA256 `7f428ea3ff241e642cc7b241f8322903cc5b3188bac92d309d00f750b7cb9a47`；没有重新 seed，没有将账号内容入Git。

08:38 UTC实际检查3373/3374/3375/3376的 `/health/ready` 均200。主服务 runner/child `55747/55758`；PG55618/PID50949，物理目录 `/workspace/astra-qa/.data/rebuild-qa-20261013/browser/pg`，媒体在同级 `media`。回归使用PG55617/PID12973，物理目录 `/workspace/qa-zijing/sol-ee753ed-20261014/zijingwebsite/.data/rebuild-qa-20261013/contracts/pg`。原服务及数据均未重启、清理或覆盖。下一轮仍需先检查当前PID、输入与服务；时间戳记录不能代替存活检查。

在新快照内先执行两个原文件，再用另一 run label 执行全量。以下命令本轮未执行：

```bash
cd /workspace/astra-lifecycle-qa
env -i PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin \
  REBUILD_QA_SERVER_PORT=3373 REBUILD_QA_RUN_LABEL=sol-lifecycle-order-01 \
  REBUILD_QA_BROWSER=/workspace/zijingwebsite/.data/visual-direction-browsers-20261013/chromium-1208/chrome-linux64/chrome \
  node scripts/rebuild-qa.mjs playwright browser tests/e2e/rebuild-activity.spec.ts tests/e2e/site.spec.ts

env -i PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin \
  REBUILD_QA_SERVER_PORT=3373 REBUILD_QA_RUN_LABEL=sol-lifecycle-full-01 \
  REBUILD_QA_BROWSER=/workspace/zijingwebsite/.data/visual-direction-browsers-20261013/chromium-1208/chrome-linux64/chrome \
  node scripts/rebuild-qa.mjs playwright browser
```

若上述标签已经存在，应换新标签，不覆盖旧证据。默认主题及历史同意专库守卫保持原样；全量中的条件跳过和前置阻断必须分别记录，不因本轮修复推定全通过。

本轮原始资料位于 `/workspace/qa-zijing/astra-payload-lifecycle-20261014`：`build-01.log`、`regression-negative-01.{log,json}`、`regression-01.{log,json}`、`collect-01.log`、输入核对及运行交接。构建runner/child为90777/90788，已自然结束；新副本只保留产物，没有新增后台测试或服务。原始文件hash、两spec逐字节检查、实际进程及 pass/fail/notrun 分界见 [机器证据](evidence/frontend-rebuild-payload-lifecycle-20261014.json)。

代码侧没有新增阻塞；下一步为 Sol max 独立运行顺序组合及完整126项。官方微信编译/真机继续未运行；既有CI账户阻塞和后端能力差异仍按原记录保留，本轮没有检查新CI结果、操作付款、部署或上传微信。
