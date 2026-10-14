# Sol 独立完整复验 · 2026-10-14

受测提交 `728387059972e6795b0431514ece59dfd3279dc7`，源码提交 `2fd2404938ea4c84c274aabc3ec329590e299c18`。根工作区开始干净，远端 new 一致；main/littleapp 仍为 e366f3c。已独立逐字节核对 626 个输入和 BUILD_ID `0V_1ao2PM56qrzXsn8W8G`，复用优化构建。本轮只运行测试、诊断及写验收文档，没有修改实现、测试或断言。

## 完整执行终态

**完整验收未通过：主126项E2E有可稳定复现的跨文件测试实例生命周期阻断。** 单元、专用主题/历史授权、矩阵与独立站点补验均完成；没有修改代码或断言来消除失败。

| 项目 | 已观察结果 | 实际范围 |
| --- | --- | --- |
| 完整 Vitest | 通过 | 87 文件、1571 项：1571 通过、0 失败、0 跳过；83 常规文件与4个专库文件无重叠 |
| 原30单元失败 | 通过 | 逐文件、完整名称匹配本轮实际结果，30/30 |
| 完整126 E2E | 失败 | 自然结束：104通过、1失败、21跳过、0 flaky、0全局错误；20.28分钟、exit1 |
| 原55 E2E失败在完整运行中 | 未全部通过 | 51通过、1失败、3未触达；完整运行不由Astra的定向记录替代 |
| 原55 E2E独立逐案证据 | 通过（跨轮） | 上述51项与独立site补验4项均通过；不改写主运行104/1/21 |
| 专用浅/深主题 | 通过 | 各11/11；原专库守卫保留，单独计数 |
| 历史false/null授权 | 通过 | 专库1/1，两状态禁止批准、本人重新同意、同一编号重提均执行 |
| 类型/lint、原生静态 | 通过 | 类型/lint exit0；25原生页、162文件静态检查；共享设计输出检查通过 |
| 五宽双主题矩阵 | 通过 | 320/320；1440/1024/768/390/320，两主题，32列出路由，320张截图 |
| 站点套件独立补验 | 通过 | 原10项全部通过，83.27秒；真实发布/预览、308/canonical、404与四宽均执行 |
| 最小两文件顺序复现 | 失败 | 2通过、1相同90秒beforeAll超时、9未运行；127.93秒，exit1 |
| HTTP边界 | 通过 | 88/88，22边界×GET/HEAD×普通UA/Twitterbot；200/307/404保持 |
| 资源 | 测量完成 | 六个390px页面/主题观察，均200、无pageerror；传输字节及绘制时间独立记录 |
| 移动复选框有效目标 | 通过（所测范围） | 原矩阵80个不足44的原始元素均为checkbox；320/390两主题20页、32控件的输入或关联label均覆盖44×44 |
| 官方微信工具/真机 | 未运行 | 三PATH命令及八明确路径仍缺工具，不以VM/浏览器映射代报 |

完整 E2E 的失败在 `tests/e2e/site.spec.ts:20` 的 beforeAll，90秒超时，首条用例0ms，后九条因前置失败未运行；另12条为既有专库条件跳过，已在上述专用轮次分别执行。正式主运行在07:56:31自然结束，未取消。矩阵在08:04:05结束，320格全部满足实际HTTP预期、单main H1、无横溢出、正确主题、零pageerror和WCAG2/2.1 A/AA Axe条件；这个范围不包括所有键盘状态或ACL组合。

## 交给 Astra 的唯一新修复目标

跨文件的默认 Payload 实例被销毁后继续复用。`tests/e2e/rebuild-activity.spec.ts:21` 使用默认 `getPayload({ config: resolved })`，第37行在afterAll销毁；`tests/e2e/site.spec.ts:23` 也使用默认实例，第60行销毁。安装的Payload3.90.1在 `dist/index.js:548` 按 `options.key ?? 'default'` 缓存，第599行返回同一实例；destroy仅销毁数据库/任务，没有移出缓存。

只读独立探针确认destroy后仍取得同一对象，后续读取报 `Cannot read properties of undefined (reading 'id')`。更直接的原测试复现为：site单文件新进程10/10通过；先跑rebuild-activity再跑site，2项先通过，随后同一beforeAll90秒超时，9项未运行。两次失败trace与独立通过结果均保留，未增加重试或超时。

最小复现（用新的run label，不覆盖原证据）：

```bash
cd /workspace/astra-build2
env -i PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin \
  REBUILD_QA_SERVER_PORT=3373 REBUILD_QA_RUN_LABEL=sol-order-repro-next \
  REBUILD_QA_BROWSER=/workspace/zijingwebsite/.data/visual-direction-browsers-20261013/chromium-1208/chrome-linux64/chrome \
  node scripts/rebuild-qa.mjs playwright browser tests/e2e/rebuild-activity.spec.ts tests/e2e/site.spec.ts
```

建议Astra为这两个spec各使用独立、稳定的getPayload key，保留现有cleanup/destroy及所有业务断言。修后先跑上述两文件，再由Sol重跑完整126项。当前没有发现需本轮改产品业务或权限的目标；本轮遵照测试模型边界，没有实施这两处测试修正。

## 资源与视觉范围

完整矩阵320张PNG及原数据在 `matrix/`；每图SHA/尺寸与对应路由/主题/宽度在 `matrix-artifact-manifest.json`。目视取样包含390浅色首页及320深色招新回执；截图仅支持对应布局，不替代接口证据。

之后在其他验收worker结束、预热的3376优化服务上，390px/DPR1/系统深色条件下，为每页/主题使用全新context实测。无网络或CPU限速，包含预取；这是单次本地观察，没有预设性能预算或生产评分。

| 页面 | 浅/深JS实际传输字节 | CSS实际传输字节 | 字体请求 |
| --- | ---: | ---: | ---: |
| 首页 | 195089 / 195089 | 54458 / 54458 | 0 / 0 |
| 活动目录 | 196740 / 196740 | 51510 / 51510 | 0 / 0 |
| 社群申请 | 200135 / 200135 | 51510 / 51510 | 0 / 0 |

六次导航至networkidle为854–1084ms，无pageerror或非读取请求。三页样本没有单独照片传输，不代表真实影像页成本；内联素材也不计独立图片请求。真实主题按钮浅→深102.0ms、深→浅65.7ms，包含点击等待及两帧绘制；持久化、表单/文件/同意保值另由完整E2E中的实际场景支持。全部原资源条目和绘制时间保留在 `resource-observations.json`。

矩阵的80个原始小控件盒是checkbox符号，不能直接当作最终点击区域。补充20个移动页面、32个可操作checkbox，逐项测量实际关联label和input，均达到44×44。没有删除矩阵条件或放宽阈值；测量不延伸成所有链接热区的完整认证。

2026-10-14 07:58 UTC 收到环境断连通知后，实际检查仍可读写环境：完整 E2E 已在07:56:31自然结束并保留JSON；矩阵原PID70659仍运行，195格当时全部通过，服务3373/3374/3375/3376仍监听。没有重启原测试或把通知当作通过。早期已完成结果正常推送为 `795182f6616398426c1a45b86a421c63185f6638`；随后完成其余复验。本轮本地资料在 `/workspace/qa-zijing/sol-final-7283870-20261014`。

## 环境与证据

完整主 E2E 使用原样冻结的 `/workspace/astra-build2/.data/rebuild-qa-20261013/browser/app`、3373与本轮合成PG55618。完整单元和专用主题/历史授权使用新626输入副本 `/workspace/sol-final-qa`，旧app不覆盖；各专库复用已确认的合成PG。新主题服务3374、历史授权3375；复用构建的695个产物逐字节一致。

视觉领域夹具脚本的主库/55613守卫未修改。矩阵使用现有合成主库、实际验证的旧夹具字节和新优化服务3376，旧3369保持；没有把夹具脚本搬到其不允许的数据库。全部 APP_ENV 为 development；NODE_ENV production仅本地优化服务，外部通知/S3/真实AI关闭，无生产部署或真实CMS/微信发布。

主完整E2E原JSON/HTML/trace在 `/workspace/astra-build2/.data/rebuild-qa-20261013/browser/runs/sol-7283870-full-e2e`；新单元、专用主题/历史授权、矩阵与诊断各有独立run label和日志。逐案结果、源清单核验与未运行步骤见 [机器证据](evidence/frontend-rebuild-sol-final-20261014.json)。不提交账号凭据、数据库、媒体或原始私有trace。

最后再次逐文件核对当前Git根和受测browser/app的626输入一致，所有新副本也在单元完成后核对一致。所有Playwright运行均自然结束；原失败、21跳过、9未触达的分组及补验结果分别登记。当前只有文档子提交改变HEAD，受测实现和构建输入保持。

08:22 UTC进程表实际核对如下，服务和合成库保留。接续重新核对PID/BUILD_ID，不依metadata推定存活；同626输入可复用当前优化产物，无需重复构建。

| 用途 | 端口 | runner / child | app / 日志 |
| --- | ---: | --- | --- |
| 主E2E | 3373 | 55747 / 55758 | `/workspace/astra-build2/.data/rebuild-qa-20261013/browser/app`；原Astra `start-02.log` |
| 专用主题 | 3374 | 65394 / 65412 | `/workspace/sol-final-qa/.data/rebuild-qa-20261013/visual/app`；本轮 `server-visual.log` |
| 历史授权 | 3375 | 65395 / 65417 | `/workspace/sol-final-qa/.data/rebuild-qa-20261013/consent-web/app`；`server-consent-web.log` |
| 矩阵/资源 | 3376 | 70540 / 70551 | `/workspace/sol-final-qa/.data/rebuild-qa-20261013/app`；`server-main.log` |

PG实际PID/端口：main664/55613、contracts12973/55617、consent12985/55614、post-edit13006/55615、native12986/55578、visual27104/55616、consent-web27094/40071、Astra browser50949/55618。各真实pg目录在机器证据 `runtimeTerminal` 和本轮 `runtime-terminal.json`；现有旧app/日志未覆盖。主/专用/最小复现run均结束，原主64004/64016的退出码1不是中断通过。

本轮只提交推送new的验收文档/证据。官方微信编译/真机、账户条件解决后的CI仍未运行；源码2fd2404的精确CI38528595757/115734765667为付款或额度启动阻塞（runner0、steps0），此前证据保持，本轮没有改付款或重跑。匿名目录门禁、骨干招新仅社长/副社长、荣誉永久私有凭证和简介逐字段私密的既有合同差异继续单列，没有扩权。

下一步需要Astra修复两个spec的实例生命周期，再由Sol复验主完整E2E；原官方微信及后端能力缺口继续保留。
