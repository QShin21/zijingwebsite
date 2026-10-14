# 紫荆完整重构：Sol 独立验收

受测提交 `ee753edb913e30004aef201929a4b280a164ef75`，业务源码检查点 `e9a8daa2`；623 文件输入清单 `c954fd8831f9063b3a70d76ae173352108033c435ce8d26f623b36a782d74e7f`。本轮只测试、诊断和写证据，不修改源码或测试实现。

## 身份与运行核验

原工作区开始时干净，远端 new 一致，main/littleapp 均为 e366f3c。逐文件确认当前源码、原最终快照与已构建输入相同。复用 BUILD_ID `iAVXxuabA81RV4I4LuoaU` 的 691 个产物文件，复制逐字节一致；在新合成 prod-browser 数据库上，3000 的活动 canonical 与 og:url 实测均使用 3000，不含旧 3369 origin。原 3369 服务、主库与旧产物保留。

既有 17 图复核包 Library ID：`libfile_077d29dc3db08191b649b8d89791af9e`，文件 ID `file_00000000a26882308d4a6d552f0ddcb0`，版本 0。3,314,137 字节；SHA-256 `5e26488fd94c229dd26e0754383f3877609413816e27927bb300a0efc365b221`；29 条目、17 PNG，压缩包检查通过。本轮没有再次上传副本。

## 已执行的独立结果

| 项目 | 结果 | 实际范围 |
| --- | --- | --- |
| 类型 / 全仓 lint | 通过 | 在新冻结 contracts 副本运行，均 exit 0 |
| 完整 Vitest（分专用库） | 失败 | 87 文件、1,571 项，1,541 通过、30 失败；83 常规套件 194.50 秒，四个特定 HTTP 套件 66/66 |
| 32 路由 × 五宽 × 双主题 | 失败 | 320 格，310 通过、10 失败；均是缺失活动状态 200 对预期 404，其他所测布局/Axe条件通过 |
| 荣誉真实浏览器 / API | 通过 | 13 项：私有 DTO 范围、no-store、旧 CAS 拒绝/说明与记录保值、明确刷新、原始 REST 拒绝、公开档案排除待审、匿名门禁 |
| 专用浅 / 深主题 | 失败 | 各 11 项，均 8 通过、3 失败；原生与网页默认浅色/手选、输入同意保留、四视口等有实际通过，三项旧定位止住后续检查 |
| 历史 false/null 联系授权网页 | 失败 | 1 项，停在旧单引号姓名定位；未走到历史 SQL 资料与批准拒绝步骤 |
| 原生静态 / tokens | 通过 | 25 页、162 文件、646,934 字节；28 份设计输出一致 |
| 原生 WXML 浏览器映射 | 通过 | 独立运行 32 格；50 个来源文件与当前源码一致。所有原阈值为 0 异常，明确非官方微信 |
| 完整 125 项 E2E | 失败 | **58 通过、55 失败、12 跳过、0 flaky**；50.29 分钟，exit 1，无全局运行错误。12 个专用条件用例已在另库实际运行，结果仍分别登记 |
| CI | 启动前阻塞 | e9a8daa 精确运行 38512641163，runner 0、steps 0，GitHub 付款/支出额度 annotation 独立复核一致 |
| 官方微信 / 真机 | 未运行 | PATH 三个命令及八个明确路径均不存在，未购买、安装非官方替代或上传发布 |

本轮资源取样使用 Chrome for Testing 145.0.7632.6、DPR 1、每页全新 context、预热的合成优化服务，无 CPU/网络限速。390px 浅色首页/活动/社群申请的 JS 实际传输分别为 197,987 / 193,608 / 200,581 字节，CSS 为 54,417 / 51,469 / 51,469 字节；字体请求均为 0，图片传输仅有各 528 字节的 icon.svg，三页均无照片 fixture。首个内容绘制分别为 260 / 132 / 248ms，导航至 networkidle 为 967 / 964 / 1006ms。资源项包含预取；这些单次本地观察含等待及工具开销，不是性能评分，也不能推断真实影像页面性能。

另在 3000 的匿名登录页按现有主题按钮入口观察，浅→深 103.5ms、深→浅 78.8ms；含 Playwright 点击、属性等待与两帧绘制，未产生非读取请求。输入、文件、授权与刷新后 SSR 的保留仍以完整 E2E 的实际通过用例为依据。首次补测误用了不存在的 fixture 路径，于浏览器启动前停止；错误与随后测量结果均留存在 theme-timing.json，未修改原测试。

## 已确认的 Astra 修复目标

1. `src/components/ActivitySignup.tsx:335` 的说明段使用 `ApplicationFlow.module.css` 的 notice 样式。启用问卷后隐私链接仅靠颜色区分，链接与相邻文字对比 1.54:1，Axe `link-in-text-block` 严重违规。首个真实复现 `tests/e2e/activity-signups.spec.ts:476`。必须修实际内嵌链接辨识，不能改 Axe 条件。
2. 缺失活动 GET 在浏览器 UA 与 Twitterbot 下均为 chunked 200，包含 `NEXT_HTTP_ERROR_FALLBACK;404` 和 noindex；HEAD 也为 200。旧 4733 矩阵曾观察 404。本轮另见未授权 community/review 页面预期404实际200、旧 slug 永久重定向预期308实际200；私有二维码越权仍404。修复目标覆盖 notFound 与 permanentRedirect 的整体响应边界。本轮定位到响应流式语义差异，不据此预定移除 loading、加 proxy 或更改断言的方案。Astra 应调查 `[...path]/page.tsx`、父布局与响应边界，以最小兼容方案保持 HTTP 合同、访问控制和旧重定向。
3. 三个组件测试文件的 VM loader 没有适配新增 `./team-pages/TeamPages.module.css` 导入，29 项在 require 阶段失败：team-core-controls-component、team-honor-editor-component、team-honor-feedback。新增依赖和 hook/子组件必须按真实代码适配，保留防重、保值、CAS、SSR禁用和导航断言。
4. `tests/miniapp-staff-flows.test.ts:161` 的 visibleGuard 只识别 button/block，实际守卫位于 staff-review WXML 第 13 行的 view，条件仍是 item.allowed.length。保留可见性与原始事件写入拒绝检查，按真实模板解析。
5. `TeamProfilesPanel.tsx` 的 editorAside 使用 aside 嵌套在其他地标内，完整 Axe 报 landmark-complementary-is-top-level（moderate）。真实复现 team-profiles.spec.ts:104；WCAG 标签过滤的矩阵不包含这个 best-practice 规则。应按表单帮助语义调整地标结构，保留标题、预览、返回与全部 Axe 断言。
6. 后续 E2E 定位尚需逐条核对。已见 `.signup-management > p[role=status]`、`3 · 预览试填`、关闭的制作工具、`← 我的荣誉记录`、旧进群说明与空态标题。不得批量 first、删除步骤或把未走到的业务/安全步骤记为通过。

## 验收环境与操作记录

新 QA 根为 `/workspace/qa-zijing/sol-ee753ed-20261014/zijingwebsite`，短别名 `/workspace/sol-zijing-qa` 指向同一目录。使用原样复制、按清单验证的 `scripts/rebuild-qa.mjs`；只创建新专用合成库，没有读取真实配置或用户资料。主完整 E2E 为新 prod-browser / 55619，HTTP服务 3000；专用 visual / 55616、3370；历史授权 consent-web / 40071、3371。常规单元 contracts / 55617，名片 consent / 55614，POST编辑 post-edit / 55615，原生严格HTTP native / 55578。全部 APP_ENV development，外部通知、S3与真实AI关闭。

新长路径的 PostgreSQL Unix socket 长 109 字节，AF_UNIX bind 实测报 path too long。保持同一源码与数据库，使用 Node preserve-symlinks-main 从短别名运行，socket 78 字节后启动成功，未改变守卫或系统配置。原生映射首轮找不到该新根下的 Chromium；接入已安装的官方 Chrome 缓存路径后原脚本运行通过，失败输出保留。

本轮两次执行错误如实保留：同步命令曾误在原根运行，覆盖五个旧 QA app 输入；594 历史文件/副本从 Git 4733 精确恢复，新增文件与覆盖后内容保留，原库/构建/日志未动。旧 metadata 创建时间未恢复，恢复记录在 sol-sync-recovery-20261014/recovery.json。调用老 probe 的 help 曾误触执行，在已停 3364 的首次登录即失败，旧摘要被覆盖；从匹配的 Git/旧ZIP机器证据恢复13条历史记录，新失败留存，原截图与数据库未动。无法证明恢复后的摘要字节哈希等于原件，语义记录相同。

完整源清单、原产物与 root 源码持续核对一致。所有失败 trace、截图和数据库保留。下方已追加本轮终态和实际进程信息；只在 new 提交推送验收文档与证据，未部署、发布真实CMS或上传微信。


## 完整终态与复现清单

完整 E2E 在 `05:03:50–05:54:11 UTC` 自然结束。125 条均有明确结果：58 通过、55 失败、12 按专用数据库条件跳过，没有进程取消、未完成或全局异常。专用浅/深两轮各 8/3，历史联系人授权专库为 0/1；不能把这些局部结果相加成一个“全量通过”数字。

55 条失败的文件、原行号、步骤、原始错误摘要和 trace 路径在 [完整失败清单](evidence/frontend-rebuild-sol-e2e-failures-20261014.json)。诊断分组为 48 条定位/可见性阻断、4 条 HTTP 状态合同差异、1 条 URL 片段差异、1 条真实内嵌链接可辨识性、1 条真实地标语义缺陷。定位或可见性阻断仍须逐条与实际 DOM/API 核对，不能全部推定为测试错误；阻断之后的业务步骤未验证。

真实通过的安全与交互证据包括：活动升推/降级复用原报名ID；活动 A→B 与 NULL→B 后旧范围不能读名单/单条/导出；原生审核缺省保留内部备注且不向申请人返回；同版本并发只一次生效；实际媒体 HTTP、Range/解码路径不能旁路私有荣誉与旧视频标记；荣誉单一置顶档案与6+1分页排除待审；旧周期迟到请求不能恢复展示；简介取消/返回恢复焦点且不保存、撤权后旧页不能写、切换队伍不越权、旧版本冲突保留输入及真实接口拒绝XSS/敏感字段/跨站。每项只支持对应场景，不代替所有角色和状态组合。

部分退出、荣誉编辑/撤回/复审、未知写后重试、表单工具完整制作及历史 false/null 浏览器链路停在失败点，继续未验证。末尾荣誉流程在“草稿已保存”的旧反馈定位处停止，尚未登记新荣誉ID，afterAll 删除被引用队伍发生 FK 拒绝。数据库与 FK 规则保留；Astra 应让测试及时记录真实已创建对象以可靠清理，不能删约束或清空库。

## 留给 Astra 的顺序

1. 修实际界面：启用报名说明的内嵌隐私链接；简介辅助栏地标语义；公共缺失/受限页面与旧 slug 重定向的真实 HTTP 状态。私有接口403/404、权限与旧路由对象保持。
2. 修 4 个单元测试文件的环境适配，保持全部29项行为检查与原生无授权写入检查。
3. 按失败清单修真实入口/标签/折叠工具/反馈作用域的定位，补齐合法表单 fixture；单引号历史授权定位也需覆盖。保留唯一性、保值、CAS、权限、分页、像素与Axe条件。账号 history 的新片段 `#applications-title` 应按已存在的query与对象跳转核对；不使用宽泛first掩盖歧义。
4. 逐领域有可复现修复后交 Sol 复测关键失败，再运行当前版本完整回归。未通过的 55 条不能仅靠本记录宣布修复。

## 证据与可恢复运行

[机器证据](evidence/frontend-rebuild-sol-20261014.json) 记录来源、计数、独立CI查询、复用构建、失败及范围限制。原始资料保留在 `/workspace/qa-zijing/sol-ee753ed-20261014`；日志为 `/workspace/qa-zijing/logs/sol-ee753ed-*-20261014.log`。主 E2E JSON、HTML报告、所有失败截图与 trace 在 `/workspace/sol-zijing-qa/.data/rebuild-qa-20261013/prod-browser/runs/sol-ee753ed-full-e2e`，当前进程已结束，不重启旧 run label 充作复测。

保留可复用服务及新合成数据库：

| 服务 | 端口 | runner / child PID | 数据库 PID / 端口 |
| --- | --- | --- | --- |
| 完整 E2E 优化服务 prod-browser | 3000 | 17540 / 17551 | 14252 / 55619 |
| 专用 visual | 3370 | 29553 / 29564 | 27104 / 55616 |
| 历史授权 consent-web | 3371 | 29594 / 29605 | 27094 / 40071 |
| 原最终设计服务（保持） | 3369 | 7450 / 7461 | 664 / 55613 |

常规单元/专用HTTP PostgreSQL PID：contracts 12973（55617）、consent 12985（55614）、post-edit 13006（55615）、native 12986（55578）。新库路径均为 `/workspace/sol-zijing-qa/.data/rebuild-qa-20261013/<profile>/pg`；原主库继续在 `/workspace/zijingwebsite/.data/rebuild-qa-20261013/pg`。接续先核实PID和端口，metadata不是存活保证。

本轮已逐字节复用相同产物并验证3000运行origin，无重复构建。若Astra改变源码，需新快照/构建；如果只修测试定位，先比较构建输入再决定复用。既有runner的工作目录自动为对应profile/app，短别名须用 `node --preserve-symlinks-main /workspace/sol-zijing-qa/scripts/rebuild-qa.mjs …`；原3369路径无需别名。禁止覆盖旧快照、重放未知写入或跳过守卫。

官方微信工具/真机、实际SDK媒体权限/键盘/安全区/分享与弱网均未运行；原生VM、HTTP和标注映射不替代它们。GitHub账户付款/支出额度仍阻止精确源码CI启动，未购买、调预算或重跑。完整重构的荣誉永久私有凭证与简介逐字段私密能力差异仍按既有合同记录，没有扩大公开或管理权限。
