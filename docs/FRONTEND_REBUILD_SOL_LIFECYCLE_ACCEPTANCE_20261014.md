# Sol · Payload 生命周期修复独立复验

受测 `new@db6a21dd2d095c62e4a40fd26babbf87dbaa6dc0`。本轮只测试及写报告，没有修改实现、测试断言或运行参数。开始时工作区干净、本地与origin/new一致，保护分支仍为 `e366f3c6538e6c63c9f13fc183e26c32ce58cf11`。

## 本地验收终态

**本轮约定的本地合成环境验收通过。** 完整主运行自然结束，114通过、0失败、12条专用条件跳过；这12条均已在本轮对应专库实际执行通过，没有前置阻断或未触达用例。保留主运行与专库各自统计，不将其写成一个profile内126项全通过。

| 项目 | 已观察结果 | 实际范围 |
| --- | --- | --- |
| rebuild-activity→site原文件顺序 | 12/12通过 | 0失败、0跳过、0flaky、0全局错误；自然exit0 |
| 受影响真实PG单测 | 1/1通过 | 同一配置、真实Payload/适配器/pg.Pool、实际读写及清理；PG55617 |
| 独立类型检查 | 通过、exit0 | 当前628输入、`tsc --noEmit --incremental false` |
| 主126项E2E | 114通过、0失败、12条件跳过 | 14.92分钟，09:03:30 UTC自然exit0；0flaky、0全局错误，0前置阻断或未触达 |
| 专用浅/深主题 | 各11/11通过 | 两轮在PG55616顺序执行，原专库守卫保持；均无跳过、flaky或全局错误 |
| 历史false/null授权 | 1/1通过 | PG40071；两状态拒绝批准、本人明确同意、同一编号重提均执行 |
| 五宽双主题矩阵 | 引用精确旧版本320/320 | 原受测7283870，32路由×1440/1024/768/390/320×浅深；原报告及320张PNG hash已独立重新核对 |
| 优化构建 | 引用当前输入的Astra构建 | 新BUILD_ID `2Z7rxMMAeA16zLPDrP9fg`、exit0；本轮独立核对628输入并重新类型检查，无产品输入变化，不重复构建 |
| 当前SHA的CI | 账户启动阻塞 | run38537020168/job115762259317，runner0、steps0；没有执行CI测试或构建 |
| 官方微信/真机、真实部署 | 未运行 | 本地优化服务和合成测试不替代官方或真实环境验收 |

顺序组合 `sol-db6a21d-order-01` 在08:45:19–08:47:07 UTC自然结束，原12项全部在同一workerIndex0完成；报告duration104939.071ms，无重试。主全量 `sol-db6a21d-full-01` 在08:48:32–09:03:30 UTC自然结束，报告duration895296.446ms，所有实际执行结果均为passed、retry0；单并发worker槽，记录的workerIndex为0和1。顺序组合先通过，随后才启动主全量。

主运行实际通过包含：真实发布/预览/撤下、HTTP404与308和canonical、匿名及跨对象访问拒绝、私有答卷和CSV点击下载、问卷失败保值/CAS、注册合成SMTP成功及发送失败、登录returnTo、主题持久化、成员资格撤销即时失权、荣誉revision与真实HTTP/JWT材料上传、跨集合视频借用拒绝、离队后的历史与私有资料边界。原业务断言完整执行，没有替换成截图或仅收集。

## 十二条条件跳过的实际覆盖

`club-theme.spec.ts` 7条及 `club-visual.spec.ts` 4条的原守卫要求数据库名以 `_clubqa_synthetic` 结尾；主PG55618不满足，故跳过。两文件在本轮PG55616/3374浅色11/11、深色11/11，均无跳过或全局错误；两轮按顺序执行。

| 原条件用例 | 对应本轮执行 |
| --- | --- |
| club-theme：四视口布局/标题/Axe、微信名片未同意拒绝与焦点、简介预览返回/取消/空态、简介请求加载/失败/重试 | 浅深各4条通过 |
| club-theme：即时主题切换保留输入与同意、系统深色无显式主题仍浅色、真实提交等待及中断保值 | 浅深各3条通过 |
| club-visual：四视口布局/标题/Axe、名片未同意拒绝与焦点、简介预览返回/取消/空态、请求加载/失败/重试 | 浅深各4条通过 |
| community-application：历史false/null不可批准，本人明确同意后同编号重提 | 原限定PG40071/3375中1条通过；两个SQL状态均执行 |

按文件和完整用例标题逐条匹配主跳过与专库结果，12/12覆盖；没有改变skip守卫、增加重试或放宽超时。浅色report duration204406.551ms，深色138192.861ms，历史授权64023.170ms。主114条实际通过加12条有专库通过证据，覆盖原计划的126个不同用例；深色及顺序组合的重复运行不另算新增用例。

## 输入与权限边界

根工作区、新快照、browser/app与contracts/app的628个输入逐字节匹配提交清单。两份spec与9279d6f相比仅导入和实例获取调用改变，原业务断言、afterAll清理、超时及重试逐字节保持。产品、原生、scripts及配置Git对象与实现提交 `2fd2404938ea4c84c274aabc3ec329590e299c18` 完全相同，ACL未扩宽。

500个非测试输入摘要为 `be98b4eeb20534ab3f65f69919fec05482a8520ce23a5c4a0c3c65a0e5f463ea`，与现有3373/3374/3375优化服务及旧矩阵一致。原矩阵报告SHA256为 `ca761bd7c4fbd561b0166fe63edffb67621466f0f269f8a3458f4948786c945c`；引用 [原Sol完整复验](FRONTEND_REBUILD_SOL_FINAL_ACCEPTANCE_20261014.md) 的原时间、条件和有限范围，没有把截图当作ACL或所有交互状态的证明。原完整Vitest87文件1571/1571与本轮新增单项分别记录，本轮未重新运行全部1572项。

新测试快照 `/workspace/astra-lifecycle-qa`，原3373服务BUILD_ID `0V_1ao2PM56qrzXsn8W8G`；合成PG55618、视觉PG55616、历史授权PG40071及生命周期单测PG55617均沿用已核验的隔离数据。新专库测试app均628输入，连接原服务；没有覆盖旧app或重seed。APP_ENV为development，NODE_ENV production只用于本地优化服务；真实通知/S3/AI关闭。

## 证据与未验范围

本轮资料保存在 `/workspace/qa-zijing/sol-lifecycle-db6a21d-20261014`，包含 `baseline.json`、`source-scope-verification.json`、`order.log`、`unit.{log,json}`、`typecheck.log`、主及专用运行日志、`completed-checkpoint.json`、`prior-matrix-reference.json`、`exact-ci.json`、`runtime-terminal.json` 和 `final-evidence.json`。最后一份逐案汇总含126条原结果、专库/顺序结果、12条skip原因和对应通过、源校验、原始文件hash及实际进程，SHA256为 `147e6b50e861d320153a85ef0028e59bd5a05be33171e3b6b49e543455263c34`。原始JSON、trace、合成凭据、DB与媒体保留在本地，本轮只推送中文Markdown报告。

| 运行 | runner/child（均已自然结束） | 原始结果位置 |
| --- | --- | --- |
| 顺序12项 | 92305/92328 | `browser/runs/sol-db6a21d-order-01/playwright-results.json` |
| 完整126项 | 93105/93129 | `browser/runs/sol-db6a21d-full-01/playwright-results.json` |
| 浅色11项 | 93106（child见process record） | `visual/runs/sol-db6a21d-theme-light-01/playwright-results.json` |
| 深色11项 | 95527（child见process record） | `visual/runs/sol-db6a21d-theme-dark-01/playwright-results.json` |
| 历史授权1项 | 93107（child见process record） | `consent-web/runs/sol-db6a21d-consent-web-01/playwright-results.json` |

表中位置以 `/workspace/astra-lifecycle-qa/.data/rebuild-qa-20261013` 为根；HTML/test-results同级，所有run label独立，旧失败痕迹没有覆盖。单测与类型runner分别92306、92307，均exit0，完整child/时间记录也在汇总。

结束后独立复核根工作区、快照根、browser/contracts/visual/consent-web四个app共六处，628输入仍全部匹配；原3373/3374/3375/3376的 `/health/ready` 均200。主服务仍为55747/55758，视觉65394/65412，历史授权65395/65417，矩阵服务70540/70551；没有重启原服务或重复构建。各合成数据库与旧日志继续保留，后续接续须重新核验存活。

当前SHA的 [CI运行](https://github.com/QShin21/zijingwebsite/actions/runs/38537020168) 注释明确说明账户付款失败或需要提高支出限额；本轮只读检查，没有操作付款或重跑。官方微信编译、iOS/Android真机、真实网络/生产部署未运行。匿名目录门禁、骨干招新仅原主席/副主席，以及荣誉永久私有凭证和简介逐字段隐私等既有合同差异继续按 [双端合同](FRONTEND_REBUILD_CONTRACTS.md) 单列，本轮没有扩权或新增后端能力。

当前未发现需要再交Astra修复的源码或测试阻塞。原 `7283870` 主104/1/21失败及两文件复现继续保留在其原报告；本轮精确db6a21d的独立成功记录证明生命周期修复通过，不改写历史结果。
