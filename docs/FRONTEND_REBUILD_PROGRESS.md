# 紫荆主场 · 网站与原生小程序完整前端重构

## 当前发布完成 · 2026-10-15

本次用户授权部署及小程序上传、预览后，已同步 `new` 并发布应用 `c737d9c`。网站 817 份源码、候选与线上 23 路由/21 资源、十项公开浏览器检查、69 表保留及独立备份恢复、FreeKill HTTPS/WSS 均已实际核验；小程序 0.4.0 官方上传与新版二维码生成成功。构建使用本机 Windows 产物，Linux 运行兼容性已有候选和线上证据，服务器完整编译未通过。

本轮初始 Windows 全量失败、Linux 定向 78/78、隔离库生命周期 1/1分别登记，未改写成一次全量通过。手机交互、微信正式审核/发布和 CI 账户条件继续单列；原目录 27 项修改及 main/littleapp 保留，只正常推送 new。完整来源、产物摘要、恢复与边界见 [发布记录](NEW_BRANCH_RELEASE_20261015.md)。

## 前一阶段独立验收摘要 · 2026-10-14

前一阶段为文末 **2026-10-14 Sol 生命周期修复独立验收通过**。受测db6a21d：原两文件顺序12/12，主126项114通过/0失败/12专用条件跳过；该轮浅深各11/11及历史授权1/1逐案覆盖全部12条，无前置未运行。受影响真实PG单测及独立类型通过；旧精确版本320矩阵与500产品输入匹配，原证据核对保留。截至该阶段，官方微信/真机、真实部署及CI账户条件仍未验；前轮失败原样留存。

## 本轮基线与范围

- 2026-10-13 核验本地及远端 `main` / `littleapp` 均为 `e366f3c6538e6c63c9f13fc183e26c32ce58cf11`，工作区干净；从该提交创建唯一分支 `new`。
- 依据最终附件 `zijing_frontend_rebuild_prompt(1).md`（381 行，35,731 字节，Library ID `libfile_07eddb3574d08191ab7bcd6ccfcf6ae1`），按 A–E 完成整站与原生页面，不延用旧生成主视觉作为方向。
- 最新授权允许 Astra max 和领域并行，取消额度阻塞。只有整合者提交、推送；不改两个原分支，不强推，不部署、不发布 CMS、不上传微信。
- Next 16.3.5 / React 19.2.4 / Payload 3.90.1 / TypeScript 5.9.3 / pnpm 11.19.0 已由 package.json 核验；已阅读本地 Next 服务端/客户端边界、表单与状态保留说明。未改变依赖、数据库模型或迁移。

## A · 短盘点（已完成）

已确认 25 个原生页面，无子包；网页具备公开内容、社群、活动问卷、招新、队伍、荣誉、个人与管理链路。详细路由/状态/证据矩阵随源码逐项核实。

真实冲突先按源码安全范围落地：

1. `src/lib/page-access.ts` 当前匿名入口仅活动、通知、登录、注册、重置与隐私；首页、社群、队伍及其他旧入口仍需登录。重构不修改该门禁；是否扩展匿名范围需后续明确决定。
2. `canManageStaffRecruitment` 等于 `canPublish`，只有主席/副主席；骨干拥有升推审核不代表拥有招新管理权。重构不扩大权限。

素材：仓库公开图片为上一轮生成的金属 Z 主视觉；没有可核验授权的真实校园/队伍照片。新首页默认采用文字与实际内容组成的编辑式封面；CMS 合法配置图片继续可用，真实照片缺口单列。既有 BrandMark 与“竞在紫荆 / ZIJING ESPORTS”已有源码使用，保持、不重画社徽。使用系统中文字体，不新增远程字体或未经授权素材。

## 共享实现与文件归属

- 整合者：`src/design/tokens.json`、生成脚本及双端 tokens 输出；网页根布局、全局样式、visual-direction、首页、登录/注册/账号、旧 catch-all 阅读页；Git、运行环境、汇总文档。
- 社群/队伍/荣誉：`(frontend)/community`（除 promotions）、`(frontend)/teams`、`(frontend)/_club`，对应 Community / Team 组件。先社群联系申请和荣誉审核闭环，再剩余队伍链路。
- 活动/内容/骨干：`events`、`announcements`、`gallery`、`activities`、`join/staff`、`staff/manage`、`community/promotions`，对应活动/内容/招新组件与 Questionnaire 展示（不改问卷引擎）。
- 原生：`miniprogram/src` 除生成的 `lib/design-tokens.js`；保持 WXML/WXSS/JS、25 页及问卷语义。消费共同 tokens，不独自维护色板。
- 验证：独立盘点测试环境/权限覆盖、合成 QA 与截图脚本；不改业务权限。只向整合者提供定向改进。

共享接口保持原导出和既有业务 props；新界面直接调用原数据服务，不另建 mock 层。语义色沿用 `--z-*`，新增 success/warning/info/控件边界等必要语义；网页与原生从 `src/design/tokens.json` 生成。主题仍 `zijing_theme`，无偏好默认浅色，显式深色持久化，不跟系统、不刷新路由、不清表单。

## 初始验证边界

旧任务的通过记录不作为本轮结果。以下检查点仅记录本次独立执行的检查及待完成项。

## B–C · 第一可运行检查点

2026-10-13：在 `new` 实现共同色板与字级/间距、网页SSR主题meta、原生生成配色与20个原创tab图标；重写首页、导航、简洁页脚和受保护 `/design-preview/system` 样张，默认文字编辑封面、真实活动/社群条目，无生成舞台依赖。保留CMS配置和原内容投影。

同时完成首批真实业务结构：社群目录/详情/联系与人工入群、管理员申请/审核；荣誉三段填写、私有审核与年鉴；活动日期列表/详情/报名/问卷、骨干/升推/风采工作台；认证失败保值、安全登录返回、本人事务中心与阅读页；原生全部25页目录/表单/审核结构。详见 [双端合同与路由](FRONTEND_REBUILD_CONTRACTS.md)。接口、集合、身份、迁移、私有媒体后端没有改动；新增薄前端action反馈、安全同站返回参数、原生公开荣誉摘要与深链兼容均已列出，不把UI显隐当ACL。

本检查点实际验证：

- 网页类型检查、全仓Lint、git diff --check通过；移除原生主题中无用途的active引用别名，保留监听/生命周期。
- 首页/样张×浅深×1440/390，8张真实Chromium145截图：200、单H1、无横向溢出、Axe WCAG2/2.1 A/AA零违规、无pageerror。浅色系统偏好测试条件为OS深色；开发工具浮标在截图中隐藏，未修改产品内容。最终色板调整后重复截图留证。
- 单源tokens 5项通过；首次浅控件边界在tint背景为2.987:1，已调深至#807A82后通过3:1，无降低阈值。
- 原生21文件780项VM/合成SDK与静态合同通过，25页/161文件静态检查通过；移除无用途引用、修正320px报名输入最低44px后，theme与rebuild-native 26项复验通过。28组WXML浏览器映射已生成，其余触控尺寸问题留待D修正；不等于官方编译或真机。
- 社群/简介/荣誉组件模型5文件60项、问卷/骨干纯测试90项与新增反馈5项、安全返回36项均通过。
- 隔离真实HTTP：名片同意27项、miniapp POST编辑19项、原生荣誉+简介20项通过。活动新增E2E第一条通过真实填写→错误→主题保值→断网核对→唯一回执→未授权名单403；骨干第二场景通过真实发布拒绝→填写保留→修正后保存唯一草稿→未公开批次API404；账号4个场景分别通过错误焦点/主题保值/本人事务/退出/旧阅读，均Axe零违规、390px无溢出。初跑Next route-announcer和带hint标签造成定位失败，收窄业务定位后通过，没有放宽业务断言。
- 权限基线初跑因浏览器合成骨干数据触发全库回滚限制（合理拒绝），迁移后无seed的contracts专库复跑4项全过。另一AI配置首跑被本任务无效测试endpoint触发守卫，清空base/key后13项mock用例通过；没有外部AI请求。新增12文件142项数据库/基础设施合同通过。保留初跑失败记录，不冒充一次全绿。

尚未完成：最终构建/全套E2E/完整视觉状态矩阵/CI；队伍管理两页和TeamCoreControls继续D；官方微信开发者工具、真机、发布均未执行。第一检查点仅保存可审查进展，不声称全重构完成。

## D · 完整领域与收尾

第一可运行检查点已正常推送 `new`：`70bdd5f483e09de8c8a091efd8abdb7580efc033`。首批8图已保存Library：`libfile_654377db38e08191b5ed16682723488f`；对应CI https://github.com/QShin21/zijingwebsite/actions/runs/38413151101 ，当前仍在执行，不能记为全绿。

- 原生映射实测暴露320px下输入/操作区不足44px和字号过小，已修正3份WXSS中的共享/局部规则。28组映射复验无溢出、44×44不足或文本裁切；320px实测字段最低15px、正文14px、操作15px、步骤13px、编号12px。最终28张当前映射均已目视复核；受影响主题/问卷/报名生命周期/荣誉工作台等198项通过。仍有未渲染的授权/错误/阅读状态，只做了静态字号修正；映射不是微信官方编译或真机。
- 活动反馈补齐旧骨干API固定400服务器异常的结果不明文案，普通400业务拒绝保持；6项反馈分类测试通过。后端状态码与ACL未改。
- 原站功能已由新组件承接；确认源码及测试无引用后删除旧SiteHeader、ArenaArt、Artwork。保留几何标识/Icon与旧公开图片文件，避免影响可能存留的素材链接。旧 `/design-preview/community/:slug`、`/design-preview/activity/:id`、`/design-preview/apply` 将安全转到同对象正式业务页；activity继续匿名公开ID读取，apply保留edit/submitted/message，详情和申请不再维持重复UI。新首页和system样张继续可用。
- 旧预览兼容已做5项真实HTTP检查：三条307及精确目标/query通过，非法/不存在活动ID均404。首次测试APIRequest缺少同源Origin，Payload忽略cookie而进入登录；补齐测试Origin后通过，没有修改产品鉴权。
- 队伍管理索引与详情完成状态、招新和成员三区；TeamCoreControls统一在途锁、业务拒绝保值、未知结果先核对再重试。SSR表单显式POST并在水合前禁用提交，避免默认GET把说明带入URL。原服务的actor、CAS、事务、成员权威和平台角色保持。
- 荣誉投稿补齐附件数量/大小、移除与错误保值；未知写结果保留输入与文件引用，再次未知会重新要求核对。审核与历史撤下复用ActionForm，服务拒绝保留说明。真实浏览器发现失败时revalidatePath会自动替换hidden revision，已改为只有成功才失效缓存，失败待本人明确刷新；详情标题单独使用h2，列表保留h3。34项新增组件/适配检查与既有60项领域检查通过，最后浏览器复验继续记录。
- 活动已有回执的编辑中，刷新核对现在独立展示服务器回执，不卸载问卷、不覆盖五名成员填写，也不推进本地CAS。原90秒E2E预算通过503结果未知→真实GET核对→另页真实修改→本页409保值→显式重载后成功；未放宽超时。显式重载会提示放弃未提交内容。
- 冻结快照2026-10-13T14:24:54.938888Z：通用Vitest79文件1461项全部通过，332.42秒；原生荣誉/简介严格HTTP20项通过。完整E2E初跑登录/后台曾被冷编译超时中断，保留trace并按原因定点复验，尚不能计为通过。

首轮完整E2E在开发服务出现Webpack模块运行时错误、登录校验503和长时间冷编译后停止：125项收集，8通过、9失败、108未运行，退出130。账号失败trace已核对：同一用例首次200的HTML有“尚未人工确认进群”，第二次请求503未渲染页面，账号源码/断言保持。旧运行记录保留，不计为最终通过。随后旧build由本任务主动取消以释放资源（退出143，非构建失败或通过）；最终源码将一次构建，使用全新合成prod-browser数据库与`next start`重跑。`NODE_ENV=production`仅本地优化运行，`APP_ENV=development`、环回数据库和合成SMTP保持，没有生产部署。

应父任务要求，首检查点浅色首页图片另存Library：桌面 `libfile_457fccd719308191859e7ec2f4c2a746`、移动 `libfile_45d4187bed8081919e92bbc519c5215a`。全部为真实Chromium截图、合成内容，不含真实私人联系方式。

## E · 最终冻结验收（待完成）

完整类型/Lint、28份生成输出与25页/161文件原生静态检查已过。余项：最后荣誉浏览器复验、冻结源码后的完整构建和全部E2E、5宽度双主题、资源测量、精确SHA/CI终态及最终证据包。微信官方工具在PATH及明确检查的8个路径均不可用；官方编译/模拟器/真机、键盘/安全区/隐私授权/媒体能力仍未验，补验步骤保存在原生映射报告中，不以模拟SDK或浏览器映射代报。

第二源码检查点已推送 `6990741d1d05f2dee73d66fcd2c9d339abe043a2`；对应CI https://github.com/QShin21/zijingwebsite/actions/runs/38418186714 。D最终16页与8页复查均200、无横溢出、Axe违规或pageerror。荣誉同源API前后均200；提交旧修订100001被拒后仍保持100001，本人明确刷新才回到真实修订1，说明及服务器pending状态保持。

最终构建快照为575文件，SHA-256清单 `752bed60d9282e47ce1490b2a5ecf4067c7d5dd97b82db60b6bc119aff11455f`，绑定6990741。浏览器收集首次因两份主题测试的JSON导入缺少ESM import attribute而在执行前失败；仅为两行导入补`with { type: "json" }`，颜色及业务断言不变，第二次成功收集28文件125项。该测试修订单独提交，生产源码和6990741构建输入不变；原收集错误记录保留。尚不把收集成功或编译阶段完成记为完整测试/构建通过。

## 暂停与交接 · 2026-10-13 15:20 UTC

项目方要求暂停继续重构，由另一位执行者接手。本节记录暂停时可以核验的状态，不替代上面的逐阶段证据。

- 已在 GitHub `new` 分支核验本文件及上述 D 阶段记录；第二源码检查点为 `6990741d1d05f2dee73d66fcd2c9d339abe043a2`，后续两行测试导入修正也已在先前记录中说明。请接手时以实际 `origin/new` HEAD 为准。
- 原执行任务及交接收尾任务触发账户使用额度上限而停止，收尾指令未能完成。因此不能确认云端工作区是否还有尚未推送的代码、测试结果或本地进程；不得把远端现状说成已经包含全部本地最新成果。
- 本节由已授权的 GitHub 文件更新完成，只补充交接状态，没有继续开发、重跑验收、合并或部署。`main` 和 `littleapp` 不变。

### 接手顺序

1. 从 `new` 获取当前远端版本，阅读本文件和 `docs/FRONTEND_REBUILD_CONTRACTS.md`，保留全部已有提交与工作区差异，不强制重置或覆盖。
2. 若可接入原云端工作区，先检查未提交 diff、未推送 commit、后台构建/浏览器/数据库进程及现有日志，将其与远端核对。这里的状态尚未核验；不要假定进程已停止或工作区干净。
3. 先确认最终构建是否实际成功，以及两行 ESM JSON import 修订对应的提交；完整 E2E、五宽度双主题矩阵、资源测量和精确提交 CI 结果继续按“通过/失败/未运行”记录。前文 8 通过、9 失败、108 未运行的完整 E2E 不能改写为全通过。
4. 核查新主题持久化、表单失败保值、荣誉修订/私有媒体、队伍与成员权限；先复用原测试与隔离合成数据库。不得清空真实库或把本地优化运行误称部署。
5. 微信官方工具、真机、键盘/安全区/隐私授权/媒体能力仍未验。匿名浏览范围和骨干招新管理权限的两项冲突继续保持现有安全权限，另行取得明确决定再改变。

交接后的新开发由项目方指定的接手者推进；原执行者不再自行恢复本轮任务。未执行生产部署、CMS 发布或微信上传。

## Sol 冻结验收接续 · 2026-10-13（进行中）

本次 saved cloud 环境实际为 `/workspace/zijingwebsite`，初始干净 `work` 位于 `e366f3c`，没有旧 `.data`、`.next`、依赖、环境文件或运行进程。已读取 AGENTS，并安全检出现有 `origin/new` 的 `4733a4c55be8811b894f65d2057caee1acd134ca`；保留 `work` 和两个原分支。不能据此确认或恢复前轮未推工作。

权威附件改用本次指定 Library ID `libfile_b3ed4f8917948191850dc0b87c3b61a2`。全文与本环境物化字节均已核验：381 行、35,731 字节，SHA-256 `1b1cb8e82084a4b1decb4e6a3864f24bd88354665c32cebd18c282da0d3e3e4a`。源码/测试脚本修复由 Astra max 负责；此接续只安装锁定依赖、运行隔离验收和记录证据，没有修改源码或断言。

- 精确 SHA CI：run [38421393010](https://github.com/QShin21/zijingwebsite/actions/runs/38421393010)，job `115379336790` 已失败。类型、lint、86 文件/1,562 项 Vitest、原生静态检查通过；E2E 为 71 通过、37 失败、16 跳过、1 未运行，build 跳过。完整日志已保存在本环境，不能把这个 CI 当成本地结果。
- 本地 Node 24.19.0，官方 npm registry 安装 pnpm 11.19.0 和 frozen lockfile 依赖；Playwright 1.58.2 配套 Chrome for Testing 145.0.7632.6。锁文件不变，未使用系统 Chromium 154 作为验收浏览器。
- 既有 `rebuild-qa.mjs` 建立独立空环境文件、合成 PostgreSQL 与媒体目录；`APP_ENV=development`、`DB_PUSH=false`，S3/外部 AI 禁用。浏览器服务为本地优化 `next start`，没有生产部署。构建输入 594 文件清单 SHA-256 为 `4aa6c4150b8210904e23a9e9bba990f047ff2cb538e37fdbeacfb50e7cd9b955`，构建前后源仓库及 contracts 快照均无输入变化。
- typecheck、lint、共享 tokens 生成检查、25 页/161 文件原生静态检查通过。完整 build 16:28:29–16:30:40 UTC 退出 0，BUILD_ID `1LQXl0KVPMjo-UFXJdO9l`；有编译警告，保留原日志。构建产物供后续隔离浏览器服务复用，没有重复构建。
- 完整 Vitest 首轮在 contracts 库为 1,496 通过、四套件的 66 项因专用库守卫未运行，退出 1；原失败保留。用既有 consent / post-edit / native profile 补跑分别 27、19、20 项均通过。当前累计覆盖全部 86 文件、1,562 项，不能把首轮日志改成一次全绿。
- 五宽度（1440/1024/768/390/320）×双主题×26 页面，260 个实际浏览器检查已完成：初跑 232 通过，25 个页面对比度违规，3 个活动详情等待 networkidle 45 秒超时。已测 257 个页面均单 H1、无横向溢出、无 pageerror。三项超时按原预算重查为 1 通过、2 再次超时；另一次独立观察中 HTTP 200、无剩余请求。超时原因仍未确定，保留全部记录。此矩阵的通过仅涵盖所列条件，不能代替完整交互验收。
- 已确认源样式问题：`src/app/(design)/design.css:20` 的 `.z-design a` 覆盖模块 primary 文本色，通知空态及 404 主链接浅色对比 1.72:1，双主题均失败；`src/app/(frontend)/style.css:2704` 的旧 status 浅背景与 ClubPages 深色文字组合使队伍回执对比 1.90:1。密码显隐按钮在 390/320 的登录、注册、找回密码页面实测 60×36 CSS px，未达到任务书的 44px 移动热区目标。均交 Astra 最小修复，不调整验收阈值。
- 荣誉专项真实浏览器/HTTP 13 项通过：拒绝旧 revision=100001 后保留说明与原 CAS，服务器 pending 记录摘要不变，只有明确刷新才回 revision=1；匿名/无所属骨干不能读待审材料，公开档案含 approved 且排除 pending，原始 REST 与匿名首页/社群/队伍门禁保持。这里的 API/ACL 证据与截图分别保留。
- 完整 125 项 E2E 在 3000 的优化服务继续运行，未改原预算。专用 visual profile 补跑浅色 11 项为 8 通过、3 失败；失败含旧荣誉空态定位与禁用输入实际背景不符合 tokens 的期望，深色复验继续。尚未有完整 E2E 终态，不能写全通过。
- 浏览器资源已实际测量：全新浏览器 context、服务器预热、DPR=1、无网络/CPU 限速；首页/活动/社群申请的 JS 实际传输约 180–184 KB，字体下载为 0。观测加载包含 networkidle 等待，细项保留在证据 JSON，不输出性能分数。
- 官方微信 CLI 在 PATH 与 8 个明确路径均不存在。官方编译、模拟器和真机、键盘/安全区/分享进入/真实图片授权能力均未运行；静态、合成 SDK 和浏览器映射结果不替代它们。

本环境运行信息：日志 `/workspace/qa-zijing/logs`；冻结快照及各 profile 数据位于 `.data/rebuild-qa-20261013`，构建在 `contracts/app/.next`。3000 服务 runner/child PID 为 3834/3845，3364 为 3864/3875，完整 E2E 为 3926/3937；各 runner 的 `processes/*.json` 和 PG 的 `postmaster.pid` 是接手续查依据。保留进行中的进程、失败 trace、数据库和原日志，下一轮读取状态后接续，避免重复启动或重复构建。

后续必须由 Astra 处理真实样式缺陷与已复现的旧 UI 定位/反馈契约问题，再由 Sol 对新源码复测；本轮源码输入仍为 `4733a4c`。机器证据见 `docs/evidence/frontend-rebuild-sol-20261013.json`，后续终态追加到此节。

### 17:00 UTC · 按父线程指令交 Astra，保留冻结测试进程

父线程要求发现源码修复需求后立即保存证据并结束此 Sol turn，不等待剩余长测试。本次交接时完整 E2E runner/child `3926/3937` 存活，已运行约 27 分钟，最近第 91 项（公开荣誉档案、6+1 分页与非公开材料隔离）通过；日志已记录 47 通过、32 失败、12 按专用库条件跳过，另 34 项尚未有结果。这个数字是明确的局部快照，最终必须读取 `prod-browser/runs/sol-full-e2e-4733/playwright-results.json` 和 `processes/sol-full-e2e-4733.json`，不能重启同一测试冒充续接。服务 CPU 与新测试日志持续推进，没有证据表明卡在构建、资源或数据库锁。

浅色、深色专用 visual 各 11 项均已结束，分别 8 通过、3 失败，退出 1，耗时 194/201 秒。两套均通过四视口/正文 Axe、名片同意、主题保值与原生默认浅色对应的网页验证；失败为旧荣誉空态文案定位（theme/visual 各一项）和禁用输入背景像素契约。后者浅色期望 `rgb(232,228,229)` 实际 `rgb(255,253,249)`，深色期望 `rgb(53,48,56)` 实际 `rgb(32,32,38)`，不能通过改颜色断言掩盖。主题切换额外观测为 102.4ms/58.6ms，两次均保留已填登录字段；是单次本地观测且包含测试工具开销，不是性能评分。

Astra 最小处理目标：

1. `src/app/(design)/design.css:20` 链接重置优先级，以及 `src/components/activity-pages/ActivityPages.module.css:17` 的 primary hover 覆盖风险；修复主链接的实际语义前景，不改 tokens 对比阈值。另修 `src/app/(frontend)/style.css:2704` 旧 status 的硬编码浅底与深色信息文字组合。
2. `src/components/account-pages/AccountPages.module.css:214` 密码显隐按钮真实热区；保持输入可用，达到移动 44px。检查 `src/components/visual-direction/theme.css` 和相关页面模块的 disabled 规则优先级，使实际禁用字段回到单源 tokens 的语义状态。
3. 根据已保留 trace 定向更新旧界面定位与反馈语义：例如 `tests/e2e/activity-signups.spec.ts:211` 仍期待详情内直接出现问卷，实际已链接到真实填写页；同文件 503 场景期待“临时不可用”，实际显示结果未知并要求先核对回执；`tests/e2e/club-theme.spec.ts:381`、`club-visual.spec.ts:346` 使用旧空态文案。保留填写→提交→回执、唯一记录、权限与保值断言，按新职责进入对象页面，不能批量 `.first()` 或删掉行为断言。完整失败列表与原始 trace 路径见本轮证据，复现均绑定 `4733a4c`。
4. `.github/workflows/ci.yml` 的普通 demo seed 未满足新增 rebuild 用例的专用根目录/账号 fixture；精确 SHA CI 的 `rebuild-activity.spec.ts:44` 在 beforeAll 被隔离守卫拒绝。本地通过既有 QA runner 和专用 seed 正常执行该领域用例；CI 应准备同等安全的合成 fixture，不能伪造守卫标记或放宽生产保护。

其他已执行页面、API/ACL 证据与 source SHA 仍保持；没有 Sol 源码修复。`consent-web`（40071）已迁移，历史 false/null 授权网页场景尚未运行；copy-build 因 3000 被完整 E2E 服务占用而由既有 runner 拒绝，未覆盖正在使用的产物。待当前 E2E 完结，再确认并停止自己拥有的 3000 服务，执行 `REBUILD_QA_SERVER_PORT=3000 node scripts/rebuild-qa.mjs copy-build consent-web`，启动该 profile 后仅运行 `community-application.spec.ts` 的历史授权场景；先处理其依赖的旧定位问题。

继续保留所有环回数据库、三个 `next start`（3000/3364/3365）、trace 和日志。Astra 可编辑源仓库，正在跑的 E2E 只消费冻结副本；修复后按新 SHA 重新冻结并由 Sol 复测。旧构建 BUILD_ID 和各 profile 路径可供读取已有证据，无需为恢复连接重复构建。

### 17:02 UTC · 保存交接期间完整 E2E 自然结束

本次 125 项冻结 E2E 已在 `17:02:41 UTC` 退出 1：**79 通过、34 失败、12 跳过、0 flaky、0 未完成**，耗时 1,784.83 秒（29.7 分钟），报告无全局运行错误。上节 91 项数字保留为历史局部快照；当前以完整 JSON 终态为准。12 个跳过中，11 个专用视觉用例已经在 visual profile 按浅/深分别运行（各 8 通过、3 失败）；剩余历史 false/null 授权网页场景继续未运行。无需重新启动旧冻结 E2E。

本轮 build、单元测试和浏览器矩阵都已有终态，修复阻塞明确存在。完整 34 条失败的文件、行号、原始错误和 trace 路径已纳入本轮机器证据，含旧详情内联问卷/反馈定位、双标题的非精确 heading 定位、页面改版后的旧 CSS 定位、样式对比度及共享队伍 fixture 的后续状态依赖。不能统一把这些失败视作测试问题，Astra 应逐条根据实际 DOM/API 修复并保留行为约束。

## Astra 修复交接 · 2026-10-13 17:30 UTC

从干净的 `new@3bd8e6f627a6bc507d413e1838dc49282b11e20f` 接续；Sol 的测试源码仍是 `4733a4c`，原始 79/34/12 及视觉失败记录不改写。本轮按文件划分由 Astra max 修复，整合者统一审查。已阅读冻结失败的 DOM/trace 与 13 张代表截图，保持现有业务 ACL、CAS、公开范围和角色权限。

| 已证实的问题 | 本轮修改 | 新版验收状态 |
| --- | --- | --- |
| 通用链接颜色覆盖 primary；深色回执仍用硬编码浅底 | 降低链接/普通 status 重置优先级；使用共享主题变量，保留主动作 hover 前景 | 源码已修，需 Sol 新构建后复测 25 个对比度失败格及全矩阵 |
| 密码显隐热区为 36px；禁用输入/按钮被普通规则覆盖 | 显隐按钮设置至少 44px；降低普通字段排除选择器优先级，禁用背景/文字使用 tokens，移除叠加透明度 | 解析与 CSS Modules 变换通过；实际尺寸与两主题状态待复测 |
| 审核成功移出待审列表或隐藏最后一条历史荣誉后，原表单反馈消失 | `ActionForm` 支持服务器生成的成功目标；升推/风采/历史荣誉转到现有稳定反馈页，保留经筛选的 query。失败仍就地保值，原服务鉴权/修订检查/成功失效缓存不变 | 相关 16 项组件/薄适配测试通过；同次 RSC 更新下的实际导航仍待 Sol 浏览器确认 |
| 改版后的旧文案、CSS、错误角色和重复标题定位 | 沿真实报名详情→填写链接、记录内 alert/status、本人资料侧栏和当前导航定位；503 后真实 GET 核对回执再重试；继续验证唯一提交、保值、权限和分页 | 125 项/28 文件全部成功收集，未将收集记为 E2E 通过 |
| Worker 重启后共享 fixture 状态不同；合成视频等待外部站点阻塞 | 只通过原带 revision 的流程关闭已知合成招新批次；预览拒绝用例自建可清理草稿；精确拦截合成 B 站 iframe URL，保留 URL/沙箱/来源策略和站内审核检查 | 新版完整流程待测；外部视频实际播放不在此 fixture 的验证范围 |
| CI 普通 demo seed 缺少新增用例所需合成账号文件 | CI 改用既有隔离 runner 的 contracts/prod-browser 专库、空环境 sentinel、seed、一次优化构建和 loopback `next start`，保留本地 SMTP及真实测试守卫 | YAML/Bash 语法通过；远端 CI 执行结果待查 |

没有删除测试、扩大 ACL、调低 Axe/像素断言或延长既有 E2E 超时。首页匿名及骨干招新管理两处权限差异继续遵守原安全规则。修改清单、34 条原失败的处理映射和检查证据在 [Astra 修复记录](evidence/frontend-rebuild-astra-20261013.json)。

本轮实际快速检查：最终 TypeScript `--noEmit --incremental false`、26 个变更 TS/TSX 文件 ESLint、共享 tokens `--check`、7 个 CSS 文件解析、4 个模块的 Next CSS Modules pure-mode 变换、工作流 YAML/Bash 语法及 diff 检查通过。`tests/team-honor-feedback.test.ts` 16/16 通过，2.12 秒；覆盖成功跳转、普通成功刷新、失败不导航/不清输入及原权限/CAS/审计。新版 E2E 仅收集 125 项/28 文件；站点定位的 5 个有限 DOM/只读导航检查仍基于旧构建，不能替代新版验收。本轮没有启动完整测试或重新构建。

运行交接：17:28 核验 3000（runner/child `3834/3845`）、3364（`3864/3875`）、3365（`16627/16638`）仍存活，`/health/ready` 均 200，8 个合成 PostgreSQL 仍存活。三者继续使用旧 BUILD_ID `1LQXl0KVPMjo-UFXJdO9l`；旧 E2E 已结束，勿重启它当作新版回归。DB 路径/端口及日志沿用 Sol 记录，完整进程状态另存本轮机器证据。仅新增未启动 DB 的 `browser/app` 诊断副本用于新版测试收集；没有覆盖运行中的 contracts/prod-browser/visual 快照。

后续交回 Sol：保留旧日志、trace、截图和合成 DB 证据，核验并轮换本任务拥有的服务后，按修复提交冻结一次新构建。优先复测成功移出队列/隐藏最终荣誉的反馈、503 核对与失败保值、禁用状态、主按钮 hover 和密码热区，再执行全 125 项及 5 宽度×双主题矩阵。专用 visual 两套和 40071 的历史 false/null 授权场景须各在原规定 profile 执行；不放宽守卫。旧 event-detail 的 3 次 networkidle 超时尚未证实原因，保留原预算继续诊断。官方微信开发工具/真机仍未验证。本轮只正常提交推送 `new`，不部署、不发布 CMS、不上传微信。

上一轮 Sol 的本地复核包 `/workspace/qa-zijing/frontend-rebuild-evidence-4733.zip` 包含当时进度、机器证据、源码清单与 13 张代表截图，约 2.4 MB；不包含数据库、账号 fixture、环境文件、媒体原件或原始 trace，也不包含本轮 Astra 修复。所有截图为合成数据；完整截图和 trace 仍留在上述运行目录。上一轮 Sol 交接仅追加证据，本轮 Astra 则有上述已列出的源码/测试/CI 修复；两轮均未动 main/littleapp、未部署或上传微信。

## frontend-design 补充审查 · 2026-10-13 17:43 UTC

修复提交 `3f2ea932cec18f41c718eb4f15153ef55266fe9b` 已正常推送并核验远端 `new`；`main`、`littleapp` 均仍为 `e366f3c6538e6c63c9f13fc183e26c32ce58cf11`。收到用户补充要求后，全文读取官方 [frontend-design SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)，核对 Git blob `a5333457c414d20d625f307df945842c0952ecc3`。没有安装第三方工具。按任务书优先制定颜色/字体/布局计划，再结合 13 张实际网站截图和七类原生源码映射进行审查，具体取舍见 [设计审查记录](FRONTEND_DESIGN_REVIEW_20261013.md)。

本次新增两处最小呈现改进：通知等公共空态删去重复品牌眉题，让状态与去向先出现；原生首页删去并列参与方式前固定的 01/02/03，入口保留顺序、说明与路由。真实人工进群/荣誉流程步骤保留。未重做已完成模块、引入新字体或改变主题与业务权限。

原样运行既有原生映射脚本前后各一次，均为 7 页 × 两宽度（390/320）× 两主题共 28 格，退出 0；脚本记录的越界、热区不足、关键小字、裁切、页面错误与外部请求均为 0。亲自查看了首页、社群联系、荣誉编辑/审核/档案、问卷和个人中心，并复查修改后的两种窄屏首页。25 页/161 文件原生静态检查、变更 TSX ESLint、diff 检查通过。**这些是有标注的 WXML 浏览器映射及静态检查，官方微信编译/模拟器/真机仍未运行**。网站改进后的真实画面、新构建及完整 E2E 继续为未运行，不能将本次审查写为整站视觉已验收。

补充机器证据在 [frontend-design review JSON](evidence/frontend-design-review-20261013.json)。前后映射目录分别为 `/workspace/qa-zijing/frontend-design-native-before` 和 `.data/rebuild-native-preview`；每张截图带有合成/非官方标注。最终构建输入清单更新为 `/workspace/qa-zijing/source-manifest-astra-design.json`（594 文件，规范化清单 SHA-256 `340e7ba6ad83fb7d8f12088eb43d57f7c57dc0b74036bf82e1d477cf968b8759`），后续 Sol 应从包含本节两处精简的最终提交冻结。先前的 Astra 清单、旧构建、服务、数据库及失败证据全部保留。

下步切回 Sol max：执行前节列出的新版完整回归，并把通知空态与原生首页的两处精简纳入代表截图。若真实运行再暴露源码问题，保存明确复现后交 Astra；当前没有需要继续推迟至另一 Astra turn 的已确认修复目标。

## 用户纠正目标后的 Sol 检查点 · 2026-10-13 17:51 UTC

正式测试轮从干净的 `new@0a7d4b7ca45f07970cb3814be02d65866fd91715` 接续，远端一致，两个保护分支仍为 `e366f3c`。已读取最新 AGENTS、交接、合同与 Astra 修复/设计记录；594 个源码输入与最终清单逐文件核对一致，权威附件物化字节仍为 35,731，SHA-256 `1b1cb8e82084a4b1decb4e6a3864f24bd88354665c32cebd18c282da0d3e3e4a`。

用户随后明确要求：将相关完整 prompt 输入 frontend-design，按技能推进信息架构、构图、排版、配色、组件和交互的全面重构。此前审查与两处精简尚未完成这一新增目标。应父线程指令，本 Sol 轮在只读核验点停止，交回 Astra max；当前修复版不作为最终交付。未修改源码或测试实现，未启动新构建、类型/lint/单元、完整 E2E、视觉矩阵或专用授权回归，均保持“未运行”。没有新启动的昂贵作业需要取消。

精确 SHA 的 GitHub CI [38441230936](https://github.com/QShin21/zijingwebsite/actions/runs/38441230936) 已 completed/failure，quality job `115448027011`。原始 run 元数据保存在 `/workspace/qa-zijing/ci-0a7d4b7-runs.json`；读取 job 日志返回 HTTP 404 `BlobNotFound`，失败原因尚未验证。这个远端终态不能代替本地正式回归。

17:51 再核验三组旧服务均存活且健康 200：3000 runner/child `3834/3845`，3364 `3864/3875`，3365 `16627/16638`；三者 BUILD_ID 均仍为 `1LQXl0KVPMjo-UFXJdO9l`，尚未轮换至当前修复源码。没有停止、覆盖这些服务、旧快照、数据库或证据。原生官方工具/真机仍未执行。

交接机器记录见 [Sol 安全检查点](evidence/frontend-rebuild-sol-handoff-0a7d4b7-20261013.json)。Astra 可直接读取全文 `/workspace/qa-zijing/library-source/zijing_frontend_rebuild_prompt.md` 与 `/workspace/qa-zijing/skills/frontend-design/SKILL.md`（已核验官方 blob `a5333457c414d20d625f307df945842c0952ecc3`），结合当前真实源码和既有业务合同开始全面设计/实现。用户的暖浅默认、紫色、中文无衬线、权限与功能范围继续有效。仅 `new`；不部署、发布 CMS、上传微信或读取真实用户资料。


## 全面设计实施检查点 · 2026-10-14

本轮从 `new@aa107f62d1d24348cb0a12d6cae4a67a9d5a720c` 接续用户纠正后的完整设计目标。完整任务书 381 行、35,731 字节已输入 frontend-design 流程，先完成构图、色板、字级计划与自审，再分领域实施并实际截图。恢复时确认环境可读写、全量未提交源码与截图都在；原服务及并行代理已停止，没有重建仓库、丢弃改动或重复启动代理。

本阶段交付网站各领域与全部 25 个原生页的结构和交互重做，详见 [全面设计实施](FRONTEND_DESIGN_IMPLEMENTATION_20261013.md) 与 [双端合同](FRONTEND_REBUILD_CONTRACTS.md)。网站改动覆盖 52 个路由文件和相应组件，原生 25 页均实改 WXML/WXSS。首页是实际 CMS 内容构成的封面与日程；目录、新闻阅读、成果年鉴、我的事务和审核工作台各有对应结构。可靠业务服务、精确联系方式同意、角色/对象归属、修订号和媒体权限继续保持。资料公开能力差异与素材缺口明确留在合同中。

### 精确来源与构建

最终输入为 623 文件，清单 SHA-256 `c954fd8831f9063b3a70d76ae173352108033c435ce8d26f623b36a782d74e7f`，逐文件与工作区一致。[源码清单](evidence/frontend-design-source-manifest-20261014.json) 与 [机器证据](evidence/frontend-design-implementation-20261014.json) 随检查点保存。所有业务源码已冻结，后续只追加证据和交接文档。

最终隔离优化构建在 `04:31:39–04:33:48 UTC` 退出 0，耗时 **128.878 秒**，BUILD_ID **`iAVXxuabA81RV4I4LuoaU`**。构建路径为 `.data/rebuild-qa-20261013/browser/app-final-20261014`，日志 `/workspace/qa-zijing/logs/astra-full-design-final-build-20261014.log`。`NODE_ENV=production` 仅用于本地优化运行，`APP_ENV=development`、合成环回数据库、空环境 sentinel 和关闭外部通知保持；没有部署生产。

前两次成功构建也保留：10 月 13 日约 98 秒的 `-QSvWzDhiQkWbjqnN3tb0`，以及恢复后 126.214 秒的 `yV-i09_hBXO5VxmiJIMYk`。它们分别绑定旧样张清单，不能替代最终构建。

### 本轮实际结果

| 检查 | 状态 | 已执行范围及限制 |
| --- | --- | --- |
| 最终优化 build / TypeScript | 通过 | 最终 623 文件快照真实构建退出 0；另一次 `tsc --noEmit --incremental false` 通过 |
| ESLint / tokens / diff | 通过 | 全仓 lint；后加 5 个 E2E 定位文件单独 lint；28 份生成输出一致；最终 diff 无空白错误 |
| 定向 Vitest | 通过 | 23 文件、673 项，16.31 秒；包括 16 个原生套件 579 项、活动 63、社群 26、tokens 5。此后仅改荣誉 checkbox CSS 和 5 个 E2E 文件，未改这些用例覆盖的行为；不是完整 Vitest |
| 初次全面网页取样 | 失败 | 120 格：112 通过、8 失败；绑定 `f3fd037d…`。四项登录链接、两项隐私页 networkidle、两项 HTTP 状态 |
| 截图修复后网页矩阵 | 失败 | 120 格：118 通过、2 失败；绑定 `8bd84882…`。32 个路由在 390 两主题取样，关键页补 1440/1024/768/320 |
| 最终源码定点复测 | 失败 | 52 格：50 通过、2 失败；绑定最终 `c954fd88…`。五宽度/双主题，覆盖首页、社群、申请、荣誉、工作台、账号、登录、隐私等 |
| 网页布局 / Axe / 脚本 | 通过（所测页面） | 修复后 120 格及最终 52 格均单 H1、无横向溢出、无 Axe 违规、无 pageerror；不等于完整键盘/所有动态状态验收 |
| 实际 checkbox 标签热区 | 通过（5 页取样） | 初测荣誉移除证据标签 26px；修后最终构建实测 44px。其余取样标签 44–85px；未降低阈值 |
| 有限真实浏览器交互 | 通过（分别取证） | 默认浅色/手选持久化/输入保值；社群未同意零请求、503 未知结果保留文字与文件、无自动重发；简介预览/隐藏选择/返回保值与焦点。没有写入新的业务记录；不证明服务端成功链路或 ACL |
| 原生静态 | 通过 | 25 页、162 文件、646,934 字节；域名检查开启、无未解析原生依赖 |
| 原生 WXML 浏览器映射 | 通过 | 8 个合成状态×390/320×浅深共 32 格；溢出、小字、热区、裁切、页面错误和外部请求均为 0。50 个来源文件与当前源码一致；非官方编译/模拟器/真机 |
| E2E 收集 | 通过 | 28 文件、125 项成功收集，未把收集算作测试执行 |
| 完整当前版本回归 / CI | 未运行 | 全 Vitest、全部 E2E、专用主题/历史授权、当前荣誉私媒与离队 ACL、当前精确 SHA CI 交 Sol |
| 官方微信 / 真机 / 发布 | 未运行 | 未进行官方编译、SDK现场、iOS/Android真机、CMS发布、生产部署或微信上传 |

最终两格失败均为 `/events/sol-synthetic-missing-20261013` 的浅/深色：HTTP 实际 **200**，断言仍期待 **404**。真实页面已经显示未找到状态，并包含 `noindex`；额外 Twitterbot 请求也实测为 200。当前 Next 文档说明流式 `notFound` 可返回 200，但这仍与合同中的 HTTP 404 要求存在差异。没有调低断言或改成 200 来标绿；Sol 应确定期望并复现，必要时交 Astra 做最小路由响应修复。

### 截图迭代与失败保留

修复了登录页内嵌隐私链接仅靠颜色区分、队伍新建按钮/说明贴着首条记录、首页只有一条动态仍出现空次栏分隔、原生 320px 说明字号与边距，以及荣誉移除材料热区。隐私页的 45 秒超时经实际请求追踪定位为关于/联系链接预取后进入登录响应，正文一直正常；辅助链接改为点击加载后按原 45 秒预算通过。没有扩大匿名浏览权限。

骨干默认/接口说明统一为用户已确认的报名资料保留 1 年和人工删除渠道，未重写历史表单、答案、修订或实际删除机制。活动填写链接的精确名称与社群表单的精确可访问名称已同步到相应 E2E；未知提交断言核对“结果尚未确认”和本人记录入口。唯一性、权限、保值、CAS、颜色与原业务结果断言保留，正式流程仍待完整运行。

首次恢复快检误将新测试与旧执行目录混用，得到 658 通过/15 失败；原因是 `--root` 不改变相对文件读取的 cwd。已保留日志，并从冻结副本内执行同样 23 个套件，673 项通过，未改断言。有限 UI 探针前两轮社群项分别因隐藏必填文本影响 `getByLabel`、未限定的 alert 命中 Next route-announcer 而停止；改成精确可访问名称与所属 form 的 alert 后，该场景实际通过。原生初次的 fixture 模块缓存错误、六处小字失败、增加第八状态后未更新总数检查的失败也都保留。

证据目录：

- 初次网页 `/workspace/qa-zijing/full-design-web-20261013`；修复后完整矩阵 `/workspace/qa-zijing/full-design-web-review-20261014`；最终取样 `/workspace/qa-zijing/full-design-web-final-20261014`。每份 `matrix.json` 内有时间、浏览器、源码清单、状态、Axe、资源和图片对应。
- 交互 `/workspace/qa-zijing/full-design-ui-review-20261014`、`full-design-ui-review-final-20261014`、`full-design-ui-community-recheck-20261014`；标签尺寸 `/workspace/qa-zijing/label-targets-final-20261014.json`。
- 原生最终 `.data/rebuild-native-preview/{results.json,index.html}`，每张图注明“WXML 浏览器映射 · 合成数据 · 非官方微信或真机”。失败目录位于 `/workspace/qa-zijing/full-design-native-{initial-partial,small-text-failure,count-check}-20261013`。
- 六份领域交接 `/workspace/qa-zijing/redesign-*-handoff.md`；原生补充 253 项合成行为断言、167 处公共事件绑定与 3 项活动组件保值探针有独立结果，均不代替真实 SDK 或 HTTP 权限验收。

实际资源测量使用 Chrome for Testing 145.0.7632.6、DPR 1、全新 context、预热 loopback 服务、无网络/CPU 限速。最终 390px 浅色首页/活动/社群申请 JS 传输分别约 **198/195/201 KB**，CSS 约 **54/51/51 KB**，字体请求均为 0；观测导航至 networkidle 分别 **1389/1086/1039ms**。这是本次合成内容条件下的观察，含等待及工具开销，不是性能评分或真实用户数据。图片和每项资源的实际记录保存在矩阵，不用无图样例推断真实影像页面性能。

### 当前运行与交回 Sol

最终服务为 **http://localhost:3369**，runner/child PID **7450/7461**，精确 build 如上；`/health/ready` 200、schema `club-operations-1`。合成 PostgreSQL 当前 PID **664**，端口 **55613**，路径 `.data/rebuild-qa-20261013/pg`。恢复后的诊断服务 3367、3368 已正常停止，构建与日志保留；更早的 3000/3364/3365 及其数据库在恢复时已不活跃，勿复用历史 PID 当作当前状态。每次接续仍须读 `processes/*.json` 并核对实际 `/proc`。

当前有效的服务器工作目录由 Next 参数及 `PAYLOAD_CONFIG_PATH` 指向 `browser/app-final-20261014`；runner 元数据中的 cwd 仍显示旧主 profile 的 `app`。运行相对文件读取的测试时必须明确进入对应冻结副本，不能只给 Vitest `--root`。

若当前服务确已停止，可按原 runner 恢复；先核验端口和当前源文件清单，不要覆盖现存快照：

```bash
# 仅当本任务的合成 PostgreSQL 已停止且 55613 空闲时启动；不会重新 seed。
node scripts/rebuild-qa.mjs db main

# 仅当 3369 空闲时复用已完成的最终构建；不重新 build。
REBUILD_QA_SERVER_PORT=3369 REBUILD_QA_RUN_LABEL=sol-resume-final-server \
node scripts/rebuild-qa.mjs exec main env NODE_ENV=production \
PAYLOAD_CONFIG_PATH=/workspace/zijingwebsite/.data/rebuild-qa-20261013/browser/app-final-20261014/src/payload.config.ts \
node /workspace/zijingwebsite/node_modules/next/dist/bin/next start \
/workspace/zijingwebsite/.data/rebuild-qa-20261013/browser/app-final-20261014 \
--hostname 127.0.0.1 --port 3369
```

正式完整 E2E 有硬编码 3000 Origin 与各专用 profile 守卫，不能直接把全部旧脚本指到 3369。Sol 先阅读既有 `scripts/rebuild-qa.mjs`、各 spec 守卫与 fixture 脚本，使用相应合成 DB/SMTP、精确当前源码及优化运行；在有证据可复用构建时复用，环境配置要求不同则独立冻结，不覆盖旧产物。当前主合成活动 fixture 未启用问卷，活动多页填写与未知回执浏览器回归仍须按已有脚本建立有界 fixture。

Sol 优先处理：本轮新结构的完整提交/回执/失败保值与稳定导航，荣誉 revision/私媒/退回重审，队伍成员与离队撤权，匿名与多角色直访，默认主题/持久化/登录返回，以及所有旧 UI 定位是否仍对应同一行为。不能用截图代替 ACL，也不能用旧 4733/0a7 的通过或失败推定新版本结果。

当前可交付为 Astra 实施检查点，下一步交 Sol max 正式验收。已知 HTTP 404 响应差异若需源码修复，再给 Astra 明确复现；荣誉永久私有凭证、简介逐字段私密等后端能力差异应单列兼容方案，不自行扩权。保护 `main/littleapp`，仅正常提交推送 `new`，无生产、CMS 或微信发布。


### 推送回执与精确提交 CI · 2026-10-14 04:44 UTC

实质源码检查点 **`e9a8daa2ce5750dff1465e4a6b63036fde4af87d`** 已正常推送 `origin/new`。205 文件改动；623 个最终输入逐文件与此 Git 提交比对一致，源码清单仍为 `c954fd88…`，工作区当时干净。远端 `main/littleapp` 均仍为 `e366f3c6538e6c63c9f13fc183e26c32ce58cf11`。

此精确提交的 [CI 38512641163](https://github.com/QShin21/zijingwebsite/actions/runs/38512641163) 已 completed/failure，但 quality job `115684400545` 的 **runner_id=0、steps 为空**。GitHub annotation 明确提示账户付款失败或 spending limit 需要处理，任务未开始。读取失败日志命令退出 0、输出为空，符合没有执行步骤；不能把该结果归因为源码构建/测试失败，也不能把本地检查说成 CI 通过。

[CI 阻塞证据](evidence/frontend-design-ci-blocked-20261014.json) 保存实际 run/job/annotation 摘要与原始证据校验值。未调整账单、购买额度或重复触发工作流；账户负责人处理后再对该源码版本运行质量任务。后续这份纯文档回执使用 `[skip ci]` 提交，业务源码与已验证的最终构建完全相同。Sol 的本地完整验收可继续，不以 CI 账户阻塞代替本地测试。


## Sol max 正式独立验收 · 2026-10-14 05:54 UTC

从干净且远端一致的 `new@ee753edb913e30004aef201929a4b280a164ef75` 开始；源码 `e9a8daa2`、623 输入 `c954fd88…` 在前后均一致。原 3369 服务保留，691 产物文件逐字节复制到新合成验收根，3000运行 canonical/og:url 均正确，复用 BUILD_ID `iAVXxuabA81RV4I4LuoaU`；没有新build或修改实现/测试。

**正式验收未通过，需要 Astra 修复。** 本轮独立类型/全仓lint、原生25页静态/28生成输出通过。完整 Vitest 分专库87文件1571项：**1541通过、30失败**，其中四个专用HTTP66项全过；29项组件VM缺新CSS依赖、1项原生模板解析未识别view守卫，相关行为不得记通过。完整E2E125项自然结束：**58通过、55失败、12跳过、0flaky、0未完成**，50.29分钟、exit1、无全局运行错误。专用浅深各11项均8通过3失败；历史false/null授权专库0通过1失败，停在旧标签定位之前。

独立32路由×1440/1024/768/390/320×浅深共320格：**310通过、10失败**，均为missing event预期404实际200；所测布局均单H1、零横溢出、WCAG-tag Axe零违规、无pageerror。另有真实启用报名说明链接Axe严重违规，及简介aside嵌套地标的完整Axe moderate违规；这些动态/额外规则未被空问卷矩阵覆盖。荣誉真实浏览器/API13项全过；原生映射独立32格通过，来源50文件与当前源码一致，官方微信仍未运行。

资源独立取样条件与逐字节结果已写入交接及机器证据：390px浅色首页/活动/社群申请JS约198/194/201KB、CSS约54/51/51KB、字体0请求，首个内容绘制260/132/248ms，networkidle967/964/1006ms；图片仅icon.svg，不代表真实影像性能。3000匿名主题切换单次103.5/78.8ms，含工具开销，不输出性能分数。

HTTP差异还涉及无权review页404和旧slug重定向308实际200；私有二维码拒绝和原始私有接口范围仍通过，没有据此推定权限泄漏。55条E2E完整复现与trace对应见 [失败清单](evidence/frontend-rebuild-sol-e2e-failures-20261014.json)，不能统一归因于旧测试。具体最小建议、已通过的ACL/取消返回/并发，以及未走到的业务步骤见 [独立验收交接](FRONTEND_REBUILD_SOL_ACCEPTANCE_20261014.md)。

复核包身份已核验：Library `libfile_077d29dc3db08191b649b8d89791af9e`，版本0、3314137字节、SHA256 `5e26488fd94c229dd26e0754383f3877609413816e27927bb300a0efc365b221`，29条目17图；没有再次上传副本。精确e9a8daa CI38512641163独立读取job/annotation确认runner0、steps0、账户付款/支出额度阻塞；未修改账单或重跑。

机器证据在 [Sol验收JSON](evidence/frontend-rebuild-sol-20261014.json)。主E2E进程18738/18749已结束；3000/3370/3371新验收服务及所有合成DB保留，具体PID、日志、路径与原副本恢复事件见交接。先交 Astra 修实际无障碍、404/308响应、VM/模板解析与逐条UI定位，再由 Sol复测；完整未验证步骤、官方微信和后端能力差异保持列出。只正常提交推送new，main/littleapp不动，无生产部署、真实CMS发布或微信上传。

## Astra 定向修复与复测 · 2026-10-14

从干净且与远端一致的 `new@24537ef558a6ad65cf57a772a5b9ca8c0a00f465` 开始，按领域修复并由一个 Git 整合者收尾。再次核对 381 行最终附件、既有合同和 frontend-design；保留暖浅默认、紫色、编辑式校园社团结构。未修改 API、集合、迁移、依赖或身份权限；匿名社群/队伍门禁与仅社长/副社长管理骨干招新继续保持。

真实源码修复为：隐私说明链接持续下划线、六个内层地标容器、目录 loading 与详情/权限响应的边界、问卷保存后独立核对展示状态且保留草稿/CAS，以及私有 CSV 使用原生下载链接避免自动预取。第一次关闭 409 与预取重叠的 trace 保留；没有 SQLSTATE，不能证明预取是唯一事务冲突原因，未加自动重试或放宽状态断言。

| 本轮检查 | 结果 | 范围与限制 |
| --- | --- | --- |
| 隔离优化构建 | 通过 | 两次 exit 0；最终 BUILD_ID `0V_1ao2PM56qrzXsn8W8G`，83.1 秒；原警告日志保留 |
| 最终类型 / 全仓 lint / diff | 通过 | 最后测试修正后执行，类型/lint exit 0 |
| 组件及原生 VM | 通过 | 四文件 68/68，原 30 失败逐名对应通过；含在七文件 108/108 中，不能相加 |
| focused01 / build01 | 失败 | 19 项：16 通过、3 失败 |
| focused02 / build01 | 通过 | 12/12；不能代表后续构建 |
| focused03 / build02 | 失败 | 56 项：49 通过、7 失败，无跳过，15.2 分钟自然结束 |
| focused04 / build02 | 失败 | 9 项：8 通过、1 失败；包含两个顺序相关前置/兄弟场景 |
| focused05 / build02 | 通过 | 最后 CMS 问卷发布场景 1/1；9.2 秒用例 |
| 原 55 E2E 失败的当前逐案状态 | 通过 | build02 上各自最近结果均通过，新增报名保存回归另 1 通过；跨轮定向结果 |
| HTTP 边界 | 通过 | build01、build02 各 88/88；GET/HEAD、两 UA、404/307/200；站点 E2E 的 308 通过 |
| 当前 E2E 收集 | 通过 | 28 文件 126 项；收集不等于执行 |
| 当前完整 Vitest / 126 E2E | 未运行 | 本修复阶段留给 Sol max 独立执行，旧 Sol 1541/30 与 58/55/12 不改写 |
| 专用双主题 / 历史 false-null / 完整五宽矩阵与资源 | 未运行 | 本阶段未做完整独立复验；局部主题、保值、私媒和 ACL 结果逐案列出 |
| 官方微信编译 / 真机 | 未运行 | VM 和浏览器映射不能替代官方证据 |
| 本次源码 SHA CI | 未运行（账户阻塞） | 精确 `2fd2404` 的 run 38528595757 已终止；付款或支出额度阻止启动，runner 0、steps 0 |

后续失败均保留原 trace：第三方 Gravatar/B站加载、包含说明的按钮/标签、同名对象选择、正文联系兜底作用域，以及新测试目录缺少同库 seed 用户清单。只按真实 DOM、对象编号或既有夹具修正；原像素、焦点、唯一性、无报名副作用、媒体 Range、私有导出、撤权、CAS 和 Axe 继续执行。原 55+30 的逐项诊断和结果见 [机器证据](evidence/frontend-rebuild-astra-repair-20261014.json)，源文件清单见 [冻结输入](evidence/frontend-rebuild-astra-inputs-20261014.json)。

最终 626 个输入已核对根工作区和新 app 相同，500 个非测试输入与 build02 相同，清单摘要 `be98b4eeb20534ab3f65f69919fec05482a8520ce23a5c4a0c3c65a0e5f463ea`。运行目录 `/workspace/astra-build2/.data/rebuild-qa-20261013/browser/app`、服务 3373（runner/child 55747/55758），合成 PG 55618 的实际目录 `/workspace/astra-qa/.data/rebuild-qa-20261013/browser/pg`（postmaster 50949）。全部新日志、快照与探针在 `/workspace/qa-zijing/astra-repair-20261014`；最终快照 `source-snapshot-05.json`。同源码可复用优化产物，接续先查 PID/BUILD_ID 和清单；不覆盖旧 Sol/3369 目录或数据库。

完整修复解释、每轮范围、合成环境/SMTP 和接续步骤见 [Astra 交接](FRONTEND_REBUILD_ASTRA_REPAIR_20261014.md)。当前无未修复的定向失败要求立即继续 Astra；下一步切回 Sol max 全量独立复测。仅正常提交推送 `new`；`main/littleapp` 仍为 `e366f3c6538e6c63c9f13fc183e26c32ce58cf11`。不部署、不发布真实 CMS、不上传微信。

实质修复已正常推送 `2fd2404938ea4c84c274aabc3ec329590e299c18`，远端三个分支已核对。[精确 CI](https://github.com/QShin21/zijingwebsite/actions/runs/38528595757) 的 quality job `115734765667` 未启动；GitHub annotation 明确为账户付款或支出额度条件，runner 0、steps 0，没有代码测试或构建执行。日志下载目标返回 403，未获取日志正文；run/job/check/annotation 原证据校验值见 [CI 记录](evidence/frontend-rebuild-astra-ci-blocked-20261014.json)。没有改账单、额度或发起重跑。后续纯文档回执使用 `[skip ci]`，626 个已验证输入保持相同。

## Sol 独立完整复验检查点（已保存）· 2026-10-14

受测 `728387059972e6795b0431514ece59dfd3279dc7`，626输入与当前优化构建逐字节一致；没有修改实现或测试。完整Vitest87文件1571项全过，原30失败按完整名称逐条匹配通过。主126 E2E自然结束：104通过、1失败、21跳过，无flaky/全局异常，exit1；其中12为专库条件、9为site前置超时阻断，仍保留原结果。原55失败在本次完整运行中为51通过、1失败、3未触达。

浅深专用轮次各11/11，历史false/null授权1/1均通过；类型/lint和原生静态通过。五宽双主题320格仍在运行，检查点247格全部通过；原站点10项正在独立补验和定位beforeAll生命周期。环境断连通知后实际核实文件/服务/原矩阵进程仍在，没有重复启动或把中断算通过。具体PID、路径、检查点与未完成工作见 [完整复验记录](FRONTEND_REBUILD_SOL_FINAL_ACCEPTANCE_20261014.md) 和 [机器证据](evidence/frontend-rebuild-sol-final-20261014.json)。只推送new的文档证据。

## Sol 独立完整复验终态 · 2026-10-14

上述检查点正常推送 `795182f6616398426c1a45b86a421c63185f6638`。随后完成所有本轮可执行复验，626个当前根/受测app输入仍相同，产品源码和测试均未修改。正式完整验收仍**未通过**：主126项自然结束为104通过、1 beforeAll90秒超时、21跳过（12专库条件、9前置阻断），没有取消、flaky或全局异常。

- 完整Vitest87文件1571/1571；原30单元失败逐名对应本轮通过。
- 专用浅/深主题各11/11、历史false/null授权1/1；原条件守卫完整保留。
- 32路由×五宽×两主题320/320：预期HTTP、单main H1、无横溢出、精确主题、零pageerror与WCAG标签Axe；320张PNG及逐图hash保留。
- 独立HTTP88/88。原site独立10/10通过，实际改slug后308/精确location/canonical和404均执行。
- 原55 E2E失败在主运行中51通过、1失败、3未触达；site隔离补验后，逐案55项均有独立通过证据。这个跨轮状态不改写主运行失败。
- 静态类型/lint、25原生页/162文件及共享输出通过；六个390资源样本全部200且无pageerror，JS195089–200135字节，CSS51510–54458字节，字体请求0。20移动页面的32个checkbox关联点击区域均达到44×44。

唯一新阻断可用原测试稳定复现：`rebuild-activity.spec.ts` 默认getPayload后destroy，后序`site.spec.ts`复用默认缓存。单独site10/10；两文件按序为2通过、1同样90秒beforeAll超时、9未运行。只读探针也确认destroy后返回同一已不可用实例。交Astra给两个spec独立稳定key，保留cleanup/destroy及全部断言，再交Sol跑最小顺序和完整126。没有为本次测试修改实现、加重试、放宽超时或更改Axe/HTTP条件。

终态、复现命令、资源条件、每轮raw report/trace与hash、进程及未验范围见 [Sol终态报告](FRONTEND_REBUILD_SOL_FINAL_ACCEPTANCE_20261014.md) 和 [机器证据](evidence/frontend-rebuild-sol-final-20261014.json)。环境通知后实际状态可访问，原矩阵继续至320格；不将通知或中断算通过。官方微信/真机、账户解除阻塞后的CI与既有后端能力差异仍单列。仅new文档证据提交，无部署、真实CMS发布、微信上传或付款变更。

## 2026-10-14 Astra 测试实例生命周期修复

基于new@9279d6f，由gpt-6-astra max严格限于site与rebuild-activity的共享Payload生命周期修复。安装实现确认destroy不清缓存，Drizzle适配器结构被清空；新的独立实例通过各自adapter创建各自pg.Pool。两spec经专用helper分别使用e2e-site/e2e-rebuild-activity，原清理、业务断言、权限、超时和重试逐字节保持。

新增真实PG单项回归在同一配置下验证活动销毁→站点可读写→站点销毁后默认实例仍可读，并精确清理合成用户和审计。仅在新隔离app移除key的负面对照1失败，复现reading id TypeError；恢复修复后1/1通过、exit0。定向lint/diff通过，新隔离webpack构建与类型检查exit0（08:36:00–08:37:33 UTC，BUILD_ID 2Z7rxMMAeA16zLPDrP9fg）；构建警告原文保留。E2E仅收集126项/28文件，本轮未执行顺序组合或全量，不覆盖前轮104/1/21。

628输入在根工作区、新root、构建app和回归app一致；500非测试输入与既有3373服务一致。新测试快照/workspace/astra-lifecycle-qa和原合成PG55618/55617、旧服务、旧证据均保留；原合成账号夹具仅逐字节复制，不重seed或入Git。下一步Sol max用新run label依次跑两文件顺序与完整126。详见[中文交接](FRONTEND_REBUILD_PAYLOAD_LIFECYCLE_20261014.md)及[机器证据](evidence/frontend-rebuild-payload-lifecycle-20261014.json)。仅new正常提交推送，无部署、CI付款操作或微信上传；官方微信/真机及既有合同差异继续未验。

## 2026-10-14 Sol 生命周期修复独立验收通过

受测new@db6a21dd2d095c62e4a40fd26babbf87dbaa6dc0。先独立执行rebuild-activity→site原文件顺序，12/12在同一worker通过；真实PG生命周期单测1/1、当前输入独立tsc exit0。随后完整126项自然执行至09:03:30 UTC，114通过、0失败、12专用条件跳过，0flaky、0全局错误、0前置未运行，报告duration895296.446ms。

跳过的club-theme7条/club-visual4条在本轮PG55616浅深各11/11通过；历史false/null授权1条在原限定PG40071通过。按文件与完整标题逐案匹配12/12，无skip/超时/重试/ACL放宽；主profile统计仍114/0/12，重复主题及顺序运行不增加计划用例数。当前原计划126条均有本轮实际执行通过证据，正式本地浏览器验收通过。

628输入在根工作区、新root和四个app运行后共六处仍一致；产品/native/scripts/config Git对象与2fd2404相同，原断言和cleanup除实例获取外逐字节保持。引用7283870同500产品输入的320五宽双主题矩阵，原报告和320PNG hash重新核验；本轮不重复矩阵或构建，当前Astra新BUILD_ID2Z7rxMMAeA16zLPDrP9fg输入也核对一致，独立类型检查已实际执行。原完整Vitest1571与本轮受影响1项分开记录，不冒称本轮完整1572。

本轮原始报告/日志/逐案汇总在/workspace/qa-zijing/sol-lifecycle-db6a21d-20261014，HTML/JSON/trace在新快照各profile的独立run label。源代码/测试无修改，仅中文Markdown提交推送new。现有3373/3374/3375/3376均健康、DB和历史证据保留，无重seed/部署/CMS生产发布/微信上传。精确db6a21d的CI38537020168因付款/支出额度启动阻塞，runner0、steps0，本轮只读核对。官方微信/真机、真实部署及后端合同差异仍未验，当前没有需Astra继续修的代码阻塞。详见[完整中文验收](FRONTEND_REBUILD_SOL_LIFECYCLE_ACCEPTANCE_20261014.md)。
