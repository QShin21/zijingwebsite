# 小程序 0.5.0 实施进度

## 2026-10-15：环境和开发基线

- 本线程实际命令可执行，工作目录 `/workspace/zijingwebsite`；已读取最新AGENTS和官方frontend-design。
- 初始工作树干净，旧本地 `work` HEAD为 `e366f3c…`。首次跟踪 `origin/new` 的切换因旧fetch映射失败；随后确认索引/工作文件完全等于目标提交，安全建立本地分支，没有丢失修改。
- 用户明确将重构 `new` 改名为 `main` 后，GitHub API/MCP均确认默认 `main`、仅一个远端分支、SHA `83882c014e33055ec65fb73e56ea017467d278e7`。成功fetch并将本地分支改为 `main`，跟踪 `origin/main`，工作树干净。没有创建或推送任何远端分支。
- 当前基线：`83882c014e33055ec65fb73e56ea017467d278e7`。Node `24.19.0`，PATH中的pnpm `11.25.0`；项目声明pnpm `11.19.0`，依赖准备将使用项目固定版本并保留锁文件。
- 已完成25页/1自定义组件/3模板文件/28WXSS/27lib盘点，材料在 `/workspace/scratch/zijing-miniapp-review-20261015/`。旧交接文件为历史盘点，新分支和模型协调信息以本记录及最新用户指令为准。
- 已落盘 [设计方案](MINIPROGRAM_0_5_0_DESIGN.md)。A阶段范围为基础呈现、首页、活动目录、社群详情；颜色保留共享暖浅品牌，网站外观不变。

## A 阶段状态

- 开发：已启动用户指定的 GPT-6 Astra max，按文件范围实施原生基础呈现和三个样板；根代理负责 Git 整合、文档、合成截图工具及检查。
- 本阶段产品代码：三个样板已完成呈现重排、两轮截图自审及补充错误状态修复。仅三页启用 `.native-page`，共享暖浅色板与网站 `src/` 未改。
- 依赖：初次固定版本安装因默认 `/home/agent/.local/share/pnpm` 目录不可写而失败；将 XDG 数据/缓存/状态目录、PNPM_HOME 与 store 定向至 `/workspace/scratch/miniapp-050-*` 后，`pnpm@11.19.0 install --frozen-lockfile` 成功（退出0），594个包，锁文件未改动。没有读取凭据或改变系统权限。
- 合成截图工具：增加独立的 stage-a 合成数据、可选源码根目录/浏览器/输出目录/样例/宽度；保留原8样例回归套件。A矩阵扩为23个状态×320/375/390/430px×浅深主题；单独保存原始基线的三个样板作比较。截图只验证浏览器中的WXML/WXSS映射，全部浏览器网络请求阻断，原生wx副作用调用抛错；无真实二维码、私人证据或用户资料。
- 开发自测：11个测试文件187项通过；包含主题、启动、绑定、导航、社群读写/隐藏卸载/授权同意、CMS局部失败、日期投影边界及新增联系入口迟到滚动守卫。全量lint、TypeScript、tokens与原生源码检查均已实际退出0。
- 独立QA：由主助手的指定任务协调；本记录不代称其结果。
- 阶段交付：主助手最新指令授权将稳定A阶段普通提交并推送当前`main`，供独立QA读取；提交SHA和远端核对结果记入交付回执。服务器部署/微信0.5.0上传本阶段不执行。

后续每个检查点补充实际文件范围、源码SHA或未提交diff摘要、命令及退出码、截图路径/主题/尺寸/合成标识、发现问题、修复结果与未验范围。不得用历史通过替代本轮结果。

## 截图自审与已发现问题

1. 原始 `83882c…` 基线：三个样板×四宽×双主题共24组合，375px存在14处正文不足14px；保留该失败结果作为对照。
2. 第一轮样板：查看实际PNG发现活动日期栏纵向堆叠。原因是浏览器映射器遇未传入的 `featured/compact` 标识符时把整个三元/布尔表达式置空，丢失布局类；原模板调用也改为显式传值。映射器补齐缺省标识符和空属性链的本地处理，并用3项独立表达式回归测试覆盖。此修正仍属于合成近似，不构成微信官方编译验证。
3. 首页自审：通知移到首条重点活动后，余下活动压为标题与时刻/状态；保留CMS模块和活动的原顺序。320px参与按钮去掉多余内距，消除孤字换行。
4. 第二轮20状态×四宽×双主题共160组合通过；原8样例×320/390×双主题共32回归组合通过。工具检查横向溢出、44px命中区、字号、裁切、运行错误和网络请求，均为0。
5. 增补首页局部错误、社群名片/进度读取失败、等待人工邀请三个状态后，24组合中社群读取失败的8组合发现10个错误文本溢出。`.error`为100%宽的text，padding/border尚未计入盒宽。已为原生text补齐border-box，错误/回执约束容器宽度并允许长文换行；没有缩字号或隐藏溢出。重新执行23状态完整矩阵与既有回归，全部通过。初次失败截图与日志保留。

## A 阶段最终自测证据（2026-10-15）

检查时的基线与HEAD均为 `83882c014e33055ec65fb73e56ea017467d278e7`。提交前只读远端核查仍仅有 `refs/heads/main`，SHA相同；没有重建`new`。本阶段共有22个变更/新增文件：13个原生产品文件、3个预览工具、4个测试文件、2份文档。变更文件清单、SHA-256与可应用补丁随审查包保存；本文随A阶段检查点正常提交，实际提交与远端SHA由交付回执核对。

产品改动：

- `styles/native.wxss`和`templates/native.wxml`提供原生专属按钮/字段/反馈/日期/内容与媒体呈现；`app.wxss`仅增加此样式import，三页通过`.native-page`启用。
- `home`保留CMS排序、开关、指定内容、推荐与入口；首条活动突出，通知紧随，其余日程紧凑呈现。有图/无图和局部模块失败分别显示。
- `events`保留原搜索、类型、活动/通知切换和分页；活动日期使用真实startAt，上海跨日正确，缺失日期不借用createdAt。公开报名渠道明确标注，不推断问卷或本人报名记录。
- `community`保留原state、请求、权限、人工进群和媒体事件；仅增加带可见/卸载守卫的联系名片定位动作。状态、下一步、授权名片、人工邀请与独立错误反馈分开。
- 原16题型及生成运行时、共享tokens、API/集合/数据库、依赖版本、锁文件与网站`src/`均没有diff。

| 实际检查 | 最终结果 | 证据 |
| --- | --- | --- |
| `node scripts/check-miniapp.mjs` | 退出0；25页、165文件、674229字节；域名检查保持开启；原生外部依赖0 | `/workspace/scratch/miniapp-050-stage-a-native-check-accepted.log` |
| `node scripts/build-design-tokens.mjs --check --native-config` | 退出0；本轮测试也实际执行该门禁 | `/workspace/scratch/miniapp-050-stage-a-tokens-check.log` |
| Vitest指定11文件 | 187项全部通过，退出0 | `/workspace/scratch/miniapp-050-stage-a-tests-accepted.log` |
| `node node_modules/eslint/bin/eslint.js .` | 退出0 | `/workspace/scratch/miniapp-050-stage-a-lint-accepted.log` |
| `node node_modules/typescript/bin/tsc --noEmit` | 退出0 | `/workspace/scratch/miniapp-050-stage-a-typecheck-accepted.log` |
| 四个相关JS `node --check`、`git diff --check` | 退出0 | 开发代理与根代理实际执行 |
| stage-a：23状态×4宽×2主题 | 184组合，退出0 | `.data/miniapp-050-stage-a/results.json` |
| 原8样例×320/390×双主题 | 32组合，退出0 | `.data/miniapp-050-regression/results.json` |
| 原基线3样板×4宽×双主题 | 24组合，退出1；保留14处旧字号问题 | `.data/miniapp-050-before/results.json` |

11个测试文件为：`design-tokens`、`miniapp-theme`、`miniapp-startup`、`miniapp`、`miniapp-content-flows`、`rebuild-native`、`miniapp-wxml-bindings`、`miniapp-community-flows`、`miniapp-community-write-lifecycle`、`miniapp-community-contact-consent`、`miniapp-preview-expressions`（均为`tests/*.test.ts`）。新增断言覆盖无活动日期/上海跨日、原数据与actions/media保留、公开渠道不冒充本人报名，以及联系入口不写入且隐藏后不滚动。原测试的业务断言没有删除或放宽；首页VM仅接入真实新增纯投影依赖。

最终截图时间 `2026-10-15T09:13:50.338Z`，Playwright `1.58.2` / Chromium `154.0.8037.57`。184+32组合的横向溢出、过小命中区、低于阈值字号、裁切文本、页面运行错误和浏览器网络请求均为0。输出含实际fixture、每状态测量、HTML、全页/首屏PNG及源文件哈希。工具将缺省字段作为空值处理，仍是本地表达式近似；没有执行原生页面生命周期或业务事件来生成截图。

根代理实际查看了首页320/375、活动320浅与430深、社群375浅、长名称/合成图片390深、等待人工邀请320深，以及错误状态修复前375和修复后320等PNG；开发代理独立于根代理的自审查看了首页浅深、活动和社群样板。两者均属于开发自审。

交互对照入口：`.data/miniapp-050-review/index.html`，可选择样板、四种宽度和浅深主题；目录内链接完整最终矩阵、既有回归和基线记录。所有数据均为明确标注的本地合成资料。

可复现最终矩阵：

```sh
node scripts/rebuild-native-preview.mjs --suite stage-a --browser /usr/bin/chromium
node scripts/rebuild-native-preview.mjs --suite regression --browser /usr/bin/chromium --output .data/miniapp-050-regression
```

## 后续与未验证范围

A阶段开发与本地自测完成，可交独立QA。B–F仍待执行。微信官方编译/模拟器、真机键盘/安全区/授权/媒体交互、完整25页各业务模式及独立QA尚未验证；本阶段没有运行网站生产构建、服务器部署或微信0.5.0上传。主助手最新指令要求将A检查点普通提交推main供QA读取，范围仍为阶段A。源码检查与浏览器映射不替代后续门禁。

后续继续以重命名后的默认`main`为唯一整合分支，保持一个Git整合者；当前AGENTS里的旧`new`名称按用户最新改名指令解释。本阶段没有执行分支或安全设置变更。独立QA结果由主助手协调后另行记入，最终发布仍按设计方案F阶段范围执行。

## 2026-10-15：后续停用GitHub CI，阶段B启动

- A检查点已普通推送`b24d14c947b24ca10812430ffd44729bf2b592b0`；远端默认及唯一分支为`main`，工作树干净。7张样板/对照截图和完整审查包已上传Library。A的GitHub Actions作业因账户付款/消费额度限制未启动，步骤为0；本地187项测试结果与CI结果分别记录。
- 用户明确要求后续不使用GitHub CI。已检查本仓库唯一workflow原触发为`push/pull_request`，现仅保留手动定义，取消自动触发；本代理不执行手动触发、重跑或等待。后续提交消息增加`[skip ci]`，测试在执行环境运行并保存日志，不将跳过CI称为通过。没有修改组织其他项目、分支保护或安全设置。
- B范围：`communities/explore/account/list/detail/fixed`。五个入口采用各自的任务结构；加强真实授权媒体与文字层次、适度品牌细节。有图/无图分别成立，无图只用克制的品牌图形，不编造照片或内容；首页补媒体fixtures；无授权名片时降低联系CTA层级并解释当前状态。
- 保留A独立QA并行审查；B未完成全部阶段，不执行部署或微信上传。

## B阶段实现与A独立QA缺陷修复（2026-10-15）

本阶段起点为`24cba9981bf3a39a3ae5155a9e005a57b1eb071e`，该提交已普通推送，取消本仓库push/PR自动CI触发。后续未查询、触发、重跑或等待Actions。所有下述检查均在执行环境实际运行，不将跳过CI记为通过。

主助手转达Windows独立QA：确认A的P1“活动第二页失败隐藏第一页”和P2“封面缺少原生加载失败占位”；A尚未签署通过。该QA另报告static/lint/TypeScript、846项扩展小程序测试、184合成布局通过，其他207/343套件可能重叠，本文不累计这些外部数字，也不以它们代替本轮结果。官方原生工具诊断继续进行，B开发未等待该诊断。

### 产品范围和结果

- `communities`采用项目目录：真实可用封面、项目说明与进入社群动作；无图使用低对比场地图形。保留搜索、分页、登录限制、骨干招新与组织申请。
- `explore`使用队伍/荣誉两个档案入口和日常索引；`account`将实际身份、本人申请与投稿、成员记录、服务端能力限定的工作台和主题设置分区。没有新增虚构统计、本人报名聚合或取消报名能力。
- `list`按通知/动态索引、队伍/招新、荣誉日期和相册分型；保留各collection、筛选、原始记录和路由。`detail`保留问卷、本人回执、管理、公开渠道、队伍、阵容、照片和视频入口；报名动作置于封面前，文章仍按标题、封面、正文阅读。`fixed`保留七类key、公开隐私正文、联系说明和三类加入入口。
- 新增`lib/native-reading.js`、`templates/native-content.wxml`、`styles/native-reading.wxss`。纯投影保留原数据与权限；荣誉赛事日期不借用发布时间，富文本通过原安全解析后补px字级、标题、引用与列表间距。
- 首页真实CMS头图/重点活动封面与文字形成主次；无图使用克制图形。社群的名片加载中、读取失败、无授权名片、原生图片损坏分别呈现；没有可展示图片时降为刷新入口并解释，不滚动到空区。

### 两项QA缺陷与局部读取修复

1. **P1分页失败：**`events`新增独立`loadMoreError`，失败不设置整页`error`，保留`docs/page/hasMore`；重试仍请求失败页，忙碌锁阻止重复追加。`list`发现同类问题，一并使用局部错误；401继续清空受限列表并显示登录反馈。首次读取失败仍使用整页反馈。
2. **P2图片失败：**原生`image`实际绑定`binderror`，不是靠浏览器占位替代。共享封面按当前ID、collection和URL匹配，只设置`nativeCoverError`，不丢弃原媒体/图注；首页头图、社群名片/风采、阅读封面/照片/二维码各有可见失败反馈。隐藏/卸载后的回调不改页面，旧URL不能标记新图片失败；重新读取可重试。
3. **固定页迟到读取：**此前`fixed`没有账号/hide/unload票据守卫。补最小可见性、账号和请求票据，在每段异步读取后核对；换号清空正文、联系人、批次和封面；匿名privacy读取仍保留。
4. **项目筛选迟到读取：**此前`list.loadGames`没有独立读取守卫。新增独立`_gamesTicket`，隐藏、卸载、换号废弃；成功时再次核对账号，不被正常主列表读取误取消。`detail`沿用原票据，将换号/重新加载时的清空扩展到封面、二维码和视频投影。

这些是明确记录的局部读取/呈现修复。网站`src/`、共享tokens、API/集合/数据库、依赖和锁文件、16题型/问卷引擎、媒体核心及服务端权限均无diff。仍保留原social视频读取/复制合同；未触及队伍荣誉受控视频策略。

### 本地检查和截图自审

首轮完整测试有19项失败，原因均为两个旧VM测试夹具没有注入新增`native-presentation`模块。已接入真实纯投影模块，保留所有原业务断言；相关83项复跑通过，最终12文件210项通过。新增回归验证实际Page事件和延迟Promise，不调用生产接口。

| 检查 | 已执行结果 | 日志 |
| --- | --- | --- |
| Vitest 12文件 | 210项通过，退出0 | `/workspace/scratch/miniapp-050-stage-b-tests-accepted.log` |
| 全量ESLint | 退出0 | `/workspace/scratch/miniapp-050-stage-b-lint-accepted.log` |
| TypeScript `--noEmit` | 退出0 | `/workspace/scratch/miniapp-050-stage-b-typecheck-accepted.log` |
| 原生源码检查 | 25页、168文件、727637字节；域名检查开启、外部依赖0；退出0 | `/workspace/scratch/miniapp-050-stage-b-native-accepted.log` |
| tokens与原生配置校验 | 退出0 | `/workspace/scratch/miniapp-050-stage-b-tokens.log` |
| 首轮375px双主题 | 17状态、34组合，测量全部为0 | `.data/miniapp-050-stage-b-iteration-1/results.json` |
| 图片边框与补充状态复查 | 5状态×4宽×2主题，40组合，退出0 | `.data/miniapp-050-stage-b-edge-check/results.json` |
| B完整矩阵 | 65状态×4宽×2主题，520组合，退出0 | `.data/miniapp-050-stage-b/results.json` |
| A样板回归 | 23状态×4宽×2主题，184组合，退出0 | `.data/miniapp-050-stage-a-regression-b-final/results.json` |
| 既有8样例回归 | 32组合，退出0 | `.data/miniapp-050-stage-b-regression-final/results.json` |
| 针对性QA回归 | 9项通过、67项按筛选跳过；为210项的子集，退出0 | `/workspace/scratch/miniapp-050-stage-b-qa-regressions.log` |
| 交互审查入口检查 | 1560个最终文件齐全，32次状态/宽度/主题切换通过；错误及外部请求为0 | `.data/miniapp-050-stage-b-review/gallery-check.json` |

12文件为A的11个门禁加`tests/miniapp-reading-lifecycle.test.ts`。其中新增13项读取/媒体测试覆盖fixed换号、隐藏、卸载、匿名privacy；list筛选独立票据及迟到账号、分页失败和401；detail/fixed当前URL损坏及隐藏回调。其他新增断言覆盖events分页、home/communities/community原生坏图、纯投影日期与字段保留、嵌套富文本浏览器映射。

截图工具补齐原安全rich-text节点树的递归映射，旧版本只取顶层text会漏掉正文。映射保留实际字号style，转义文本并禁用任意标签/事件与URL样式；视频仅保留静态尺寸、控件及原源地址标记，不加载资源、不验证播放。全部浏览器网络请求阻断，原生wx副作用调用抛错。图片均为明确标注的合成素材，不取真实名片、私人材料或活动照片。

自审发现并修正：荣誉未知日期栏避免“日期待公/布”孤字；活动报名主动作从封面后前置，320px约y702即可看到；新闻首图来源紧贴图片；scheduled无作者时移除空署名区。首次怀疑首页无图标题缺失，随后根代理与开发代理读取原始PNG均确认文字存在，未为不可复现的显示问题修改产品。首轮截图保留。

第二轮62状态完整矩阵的496组合中，16个相册/社群图片组合出现图片超出预览按钮约2px的裁切；其余测量为0。实际DOM测量定位为100%图片宽度叠加边框，已为共享`.photo`补`box-sizing: border-box`，没有隐藏溢出或缩小命中区。增加无封面文章、招新岗位和招新二维码失败三状态；先复查40组合，再重跑最终65状态完整矩阵及A/既有回归，全部通过。失败结果保存在`.data/miniapp-050-stage-b-iteration-2`，审查包保留测量、日志及代表截图。

最终B截图时间`2026-10-15T10:10:34.074Z`，A回归时间`2026-10-15T10:07:50.663Z`，既有回归时间`2026-10-15T10:05:44.710Z`；使用Playwright`1.58.2`和Chromium`154.0.8037.57`。三个最终目录的横向溢出、过小命中区、低于阈值字号、裁切、运行错误及浏览器网络请求均为0；记录的55/34/58个源文件哈希分别与最终工作树一致。40个针对性布局为完整B矩阵的子集，不累计为额外覆盖。

### 独立复测入口

从已安装项目依赖的仓库根目录执行以下四个文件即可复测两项QA缺陷及关联边界，无需GitHub CI、真实账号或网络业务：

```sh
node node_modules/vitest/vitest.mjs run tests/miniapp-content-flows.test.ts tests/miniapp-community-flows.test.ts tests/miniapp-reading-lifecycle.test.ts tests/miniapp.test.ts
```

只运行本轮QA缺陷的9项针对性回归：

```sh
node node_modules/vitest/vitest.mjs run tests/miniapp-content-flows.test.ts tests/miniapp-community-flows.test.ts tests/miniapp-reading-lifecycle.test.ts tests/miniapp.test.ts -t '第二页失败|下一页失败|原生图片错误|活动原生封面|首页头图|原生损坏名片|项目目录原生封面|详情的损坏|固定页损坏'
```

截图复现使用`node scripts/rebuild-native-preview.mjs --suite stage-b --browser <本机Chromium路径>`；默认四宽320/375/390/430、浅深双主题。交互审查入口`.data/miniapp-050-stage-b-review/index.html`，附375px的8样板与A检查点同数据对照。所有截图属于浏览器布局映射，不能据此声称微信编译、真机键盘/安全区、媒体下载或授权交互通过。

阶段B开发、本地检查与截图自审完成。本阶段共有42个变更/新增文件：30个原生产品文件、4个脚本、6个测试文件、2份文档；实际提交SHA、正常推送后的默认分支/完整远端分支列表及各文件SHA-256由审查包`GIT_RECEIPT.txt`和`manifest.json`保存，交付时另附Library回执。独立QA可按上方命令复测A的P1/P2及关联边界；A/B尚未由独立QA签署通过。主助手最新转达Windows官方工具已编译/加载成功，官方测试preview退出0；真实模拟器截图与交互等待Codex授权提示处理，且当前B提交仍需独立复测。C–F继续待执行。本云端阶段不部署服务器、不上传微信，不使用GitHub CI。

## 2026-10-15：B独立复测通过，继续C/D

- B已普通推送`95a4a0d847667f62cc4f21f09d103f61281a18cc`，远端默认及唯一分支为`main`。主助手转达Windows独立复测：210项测试、B的520/A的184/既有32个布局、lint、TypeScript、原生静态及JS检查全部通过，无新P0/P1/P2；确认分页保留内容、图片失败反馈、生命周期与账号保护修复。此处记录外部回执，不重复累计为云端新增测试。
- Windows官方工具open/preview成功；真实模拟器截图和点击仍等待授权，不能写成全原生验证通过。云端不因此跳过C/D新回归。
- 环境中断后命令已实际恢复：读取AGENTS/设计、核对HEAD及远端，工作树起点干净。C采用三个Astra max文件分工（auth/signup/activity-manage；applications/review/community-joins；staff/staff-review），root维护共享原生表单样式、截图工具、文档与唯一Git整合。D先只读核对八页业务合同，C检查点后再修改D页面。
- C保留原16题型引擎及shared questionnaire模板；staff与team申请仍由原signup按kind处理，不复制新引擎。权限、CAS、名片展示主动同意、隐私组件、未知写入与已确认回执合同保持。新状态截图继续仅使用合成数据，四宽/双主题及业务回归将单独记录。
- D只读核对后，在`/workspace/scratch/miniapp-050-stage-d-worktree`的detached检出并行准备两个页面组补丁；没有新增分支。C源码提交不包含D改动。D准备发现荣誉编辑/工作台既有确认回执被旧成功GET从revision4回退到3的问题，root使用真实Page/HTTP合成夹具独立复现；D将最小修复并补回归，证据位于`/workspace/scratch/miniapp-050-stage-d-preparation.md`和同目录ACK复现脚本/日志。


## C阶段实现与本地核验（2026-10-15）

本阶段基于B检查点`95a4a0d847667f62cc4f21f09d103f61281a18cc`，完成八页auth/applications/review/signup/activity-manage/staff/staff-review/community-joins。以分段填写、提交前核对、本人回执、材料审核与人工进群为任务结构，使用原生专属`native-forms.wxss`；默认暖浅色与深色均沿用共享tokens。骨干招新目录与审核页不复制问卷引擎，申请仍进入原signup的staff模式。

### 合同与局部行为

- 六页JS逐字节未改。`review`仅为原记录和成功回执补真实状态中文投影；`applications`补原生名片图片失败反馈与显式预览重试。坏图保留上传材料、未提交字段和主动同意；只处理当前URL、scope及可见页面，隐藏、换号、卸载和旧图片回调均忽略。新申请/新选图/新保存内容清除相应失败状态。
- 名片展示勾选与微信图片隐私授权分别说明。未主动同意时原提交阻挡和业务文案保留；取消展示仍走原已批准名片操作。审核与人工进群沿用服务端actions、原操作参数、CAS和单次写入锁，不把意向或好友核实渲染为已经进群。
- signup完整覆盖原16题型、真实分支/跳转后的就近错误、六人成员组、核对、草稿、长只读回执、仅名单权限、高级问卷原网站入口、POST确认后GET失败与未知写入。未改shared questionnaire模板、问卷引擎、API/集合/数据库、网站`src/`、共享tokens、依赖或锁文件。

### 实际执行结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 原生相关Vitest | 28文件、905项通过，退出0 | `/workspace/scratch/miniapp-050-stage-c-tests-accepted.log` |
| 名片原生失败与生命周期 | 37项通过，为905项子集；新增3项实际Page延迟/账号回归 | `/workspace/scratch/miniapp-050-stage-c-qr-regression.log` |
| 最后文案/布局小修相关回归 | 64项通过，为已有测试子集 | `/tmp/zijing-stage-c-signup/vitest-final.log` |
| 全量ESLint、TypeScript | 均退出0；最终CSS/fixture修正后再次lint，TS文件未变 | `/workspace/scratch/miniapp-050-stage-c-lint-final.log`、`miniapp-050-stage-c-typecheck-accepted.log` |
| 原生源码检查 | 25页、169文件、769855字节；域名检查开启、外部依赖0，退出0 | `/workspace/scratch/miniapp-050-stage-c-native-final.log` |
| tokens/原生配置校验 | 退出0 | `/workspace/scratch/miniapp-050-stage-c-tokens.log` |
| C最终四宽双主题 | 67状态、536组合，全部测量为0 | `.data/miniapp-050-stage-c/results.json` |
| 既有样例回归 | 32组合，全部测量为0，退出0 | `.data/miniapp-050-stage-c-regression-final/results.json` |
| 320px步骤标签定向复查 | staff全7状态×四宽×双主题=56组合，退出0；为536组合中的替换子集 | `.data/miniapp-050-stage-c-staff-final/results.json` |
| 审查入口检查 | 1608个最终图/HTML文件齐全，32次状态/宽度/主题切换通过；错误及外部请求0 | `.data/miniapp-050-stage-c-review/gallery-check.json` |

905项选择全部`miniapp*.test.ts`中的非数据库套件，加design-tokens和rebuild-native；四个实际数据库HTTP集成套件未运行。staff分工曾额外选择后端staff-recruitment套件，在导入时因缺少`PAYLOAD_SECRET`未启动，日志保留；未读取/补充凭据、未连真实数据库，不把该项写成通过。分工的256/94/105等数字与905项有重叠，不相加。

首轮375px的134组合中有16个字号失败，均来自signup进度计数与activity-manage页码12px；修为14px，并把320px辅助动作调整到15px，没有降低门禁。分支错误fixture改用真实第二页投影，保留跳题行为；审核成功回执标题和独立隐私提示也按实际状态修正。重新捕获完整四宽后，536组合均为0。人工检查随后发现staff首步“岗位与批次”在320px下末字单独换行，缩为同义“岗位批次”，可见标签与aria说明同步；只重捕该页全部56组合。合并器验证唯一源码差异为staff/index.wxml、其他页面源码逐字节不变，替换全部staff组合，记录原始四宽运行及定向运行，不把56项额外累计。原536测量存于iteration-2，首轮失败测量存于iteration-1，原PNG与日志保留。

最终矩阵时间2026-10-15T10:51:33.853Z，58个源文件SHA-256均与C提交前工作树一致。截图使用Playwright1.58.2/Chromium154.0.8037.57，320/375/390/430px浅深两主题；横向溢出、过小命中区、低于阈值字号、文字裁切、浏览器错误和外部请求均为0。人工查看各组375代表图、320注册/必填/长答卷与430深色材料/回执，未见剩余阻塞布局问题。

### 复测与交接

完整C布局复现：`node scripts/rebuild-native-preview.mjs --suite stage-c --browser <本机Chromium路径>`。审查入口`.data/miniapp-050-stage-c-review/index.html`提供67状态切换、四宽浅深及8个375px样板与B源码相同合成内容对照。对照使用B原生源码归档，其历史字号失败单独保留，不混入当前通过统计。

本阶段28个文件包含19个原生产品文件、5个截图脚本、1个测试和3份协作文档；源码差异、准确SHA、远端默认/完整分支列表、测试日志和全部最终截图随审查包保存。C本地实现与自审完成，待主助手独立QA；D补丁仍在detached工作区，C提交不混入D。官方微信、真机键盘/安全区/隐私/媒体交互未验证，E/F继续待执行。本阶段未使用GitHub CI、未部署服务器、未上传微信。


## D阶段实现与本地核验（2026-10-15）

C检查点已普通推送`be0eedec4a77a0309f20c7307d2bc4e6bc75aecb`，远端核对仍为默认且唯一`main`；C完整审查包109147895字节、SHA-256 `ec1523ba5109a29bfb6e7915b62b1ad6a5c6a539c87eee02b4fbc529009938a7`已交付。D基于该检查点整合，两个Astra max分工从B的detached检出按24个精确路径复制进主工作区，root只合并截图入口及文档，未覆盖C源码或复制依赖目录，没有新建开发分支。

### 页面与合同

- `team`划分招新批次、本人申请、本人队伍和实际管理范围；`team-apply`组织建队计划与同编号改稿/回执；`team-review`分离建队申请、招新答卷和招新运营。完整16题型、五人成员组和审核反馈仍使用原投影。
- `team-members`按当前关系与历史关系阅读，保留撤销原因、显式确认和服务端能力；公开简介与历史阵容不当作当前资格。`team-honors`按实际赛事日期与年度归档，保留历史记录说明与原受控图片/视频。
- `team-profiles`保留本人整份visible选择、保存前预览、离队/周期变化锁定、重载默认隐藏与未知保存待核对；不增加逐字段私密承诺。`team-honor-workspace`按本人投稿/审核证据/处理决定分区；`team-honor-edit`分成果信息、证据公开范围、图片、独立MP4与保存/正式送审，100%文件传送不当作业务成功。
- 八页中五页JS逐字节未改。除下面两类已复现问题，业务引擎、原API、actions、权限、对象归属、CAS、隐私组件、媒体版本与清理合同保持。网站`src/`、共享tokens、native公共基础及C表单样式、问卷模板/引擎、依赖和锁文件均无本阶段diff。

### 两类实际缺陷与修复证据

1. **荣誉确认回执回退：**root在B源码用真实Page及HTTP合成夹具独立复现：保存/撤回已确认revision4，随后成功GET返回revision3时，编辑输入或工作台回执被旧内容替换且恢复写权限。两页新增当前账号/路由范围内的最低已确认修订记录：旧或缺失确认后的读取保留已确认文字并锁写，只允许当前或更高版本的成功读取恢复服务端实际能力；看到更高版本后提升下限。JSON保存、送审/审核操作与独立MP4确认均涵盖；隐藏后旧scope无效，换号/换路由清空下限，401/403仍清理私有内容。工作台只保留id/修订元数据，不新增原证据字节缓存。review列表合同含已批准/退回/拒绝/隐藏记录，按updatedAt倒序；正常审批不会因出队被误判。分页中已核对记录不强求再次出现，但出现旧版本仍拒绝。
2. **成员结束日期误显示：**截图发现active且无leftAt/revokedAt也显示“关系结束 / 待公布”，原因是空值进入原format.date。只在真实结束时间存在时投影endText，首次读取与成功POST后回执一致。测试夹具换用真实format而非空值特判stub；补实际Page无/有时间和POST成功后GET失败的4例，修前2例失败，修后通过。建队表单错误旁增加原retry操作以便立即核对，沿用保稿与loading/busy锁。

荣誉新增18项回归，修前80项中9失败、71通过，修后80项全通过；成员新增4项。两类共22项使整合套件从C的905增为927，重叠分工数字不重复相加。首轮375两组108截图全0后，按自审修正上述成员显示、提示间隔和重复分隔，两个确认后读取失败fixture的消息改为真实Page的成功文案。

### 实际执行结果

| 检查 | 已执行结果 | 证据 |
| --- | --- | --- |
| 整合后Vitest | 28文件927项通过，退出0 | `/workspace/scratch/miniapp-050-stage-d-tests-accepted.log` |
| 荣誉ACK红/绿回归 | 修前9失败/71通过；修后80项通过，后者为927子集 | `miniapp-050-stage-d-ack-red.log`、`miniapp-050-stage-d-ack-green.log` |
| 成员/队伍相关 | 170项通过，为927子集；新增4例修前验证失败 | `/tmp/miniapp-050-stage-d-team-final-vitest.log` |
| 全量ESLint、TypeScript | 均退出0 | `/workspace/scratch/miniapp-050-stage-d-lint-accepted.log`、`miniapp-050-stage-d-typecheck-accepted.log` |
| 原生源码检查 | 25页、169文件、791806字节；域名检查开启、外部依赖0，退出0 | `/workspace/scratch/miniapp-050-stage-d-native-final.log` |
| tokens与原生配置 | 退出0 | `/workspace/scratch/miniapp-050-stage-d-tokens.log` |
| D完整四宽双主题 | 54状态432组合，全部指标0 | `.data/miniapp-050-stage-d/results.json` |
| 最后两条提示定向复查 | 15状态120组合，全部0；替换432中的受影响子集 | `.data/miniapp-050-stage-d-honor-width-{320,375,390,430}/results.json` |
| 既有样例回归 | 最后提示修改后重跑32组合，全部0 | `.data/miniapp-050-stage-d-regression-final/results.json` |
| 审查入口 | 1296个最终图/HTML文件齐全，32次切换通过；错误/外部请求0 | `.data/miniapp-050-stage-d-review/gallery-check.json` |

实际完整命令写入测试日志：全部非数据库`miniapp*.test.ts`加design-tokens/rebuild-native，排除四个数据库HTTP集成套件。D分工额外选择的team-honor-http/team-profile-confirmation-http在导入时缺少`PAYLOAD_SECRET`未启动；未配置凭据或连接数据库，不计为通过。一次tokens命令引用了不存在的脚本，已改为仓库实际`build-design-tokens.mjs --check --native-config`并通过，错误日志保留。新命令入口曾短暂断开，随后pwd、测试完成回执和全部日志读取均实际恢复；没有因此跳过验证。

人工逐组查看375浅深代表图、320浅/430深长问卷、周期锁、荣誉材料和视频等待确认状态。将审核说明占位文案缩短为“退回、拒绝或隐藏须说明原因”，避免320px最后一字单独一行；视频等待提示明确“确认前不会重复上传”。这两条最终静态文案仅改两个WXML，源码比较证明其余页面不变；定向重捕两页全部15状态四宽双主题并替换120行，原432测量存iteration-2，各捕获时间与变更哈希在selectiveRefresh/captureRuns保留，不把120项累计为新增覆盖。动态长队名/奖项允许自然换行，未截断或缩小正文。

最终D矩阵时间2026-10-15T11:03:37.709Z，58个源文件哈希与提交前工作树一致；Playwright1.58.2、Chromium154.0.8037.57。全部最终布局/回归中横向溢出、过小命中区、低于阈值字号、裁切、运行错误及浏览器网络请求均为0。图片全部合成，视频只呈现静态尺寸/控件，没有读取私人证据或播放真实视频。

### 复测和剩余阶段

复现两个修复可运行：

```sh
node node_modules/vitest/vitest.mjs run tests/miniapp-team-honor-workspaces.test.ts tests/miniapp-team-workspaces.test.ts
node scripts/rebuild-native-preview.mjs --suite stage-d --browser <本机Chromium路径>
```

`.data/miniapp-050-stage-d-review/index.html`提供54状态四宽浅深与8个375px样板前后对照；准确提交SHA、默认/完整远端分支列表、28个源文件差异、哈希、日志及全部最终截图交付审查包。D共有19个原生产品文件、4个截图脚本、2个测试和3份协作文档。

C/D开发与本地自审完成，尚待独立QA签署。E的完整适用状态核对、官方微信/真机键盘、安全区、授权和媒体交互未完成；F发布条件尚未具备。此前B的Windows独立通过和官方open/preview结果不替代C/D新核验。本阶段没有使用GitHub CI、部署紫荆服务或上传微信，也没有操作FreeKill。

## 2026-10-15：阶段 E 集成与发布准备

基线为D检查点`4548d43b5929eac39a3f0d2e90cfa1662ef11fde`。主助手要求补齐隔离合成DB/HTTP权限、报名、队伍、荣誉回归，完成生产构建及网站不退化检查，统一客户端0.5.0并梳理现有发布入口；当前仅准备，不部署或上传，等待其汇总独立QA。本阶段仍只有一个Git整合者，正常提交`main`且消息带`[skip ci]`；没有调用GitHub CI或改变分支/安全设置。

### 源码与测试夹具

- `miniprogram/package.json`、`miniprogram/src/config.js`、`scripts/wechat.mjs`统一为0.5.0，默认上传说明更新为“原生小程序0.5.0界面更新与流程修复”。AppID、域名校验、基础库、生产origin、会话键、网站版本和协议版本均保留。
- `tests/miniapp-team-honors.test.ts`将`path.endsWith("/navigation.js")`改为`basename(path) === "navigation.js"`。Windows的`resolve()`产生反斜杠时，旧夹具未向navigation VM注入`getCurrentPages`，导致返回路径误走首页；没有改动产品导航或业务断言。
- Linux环境中的原测试夹具回放使用`path.posix`和`path.win32`，修前分别为`navigateBack=1/switchTab=0`与`navigateBack=0/switchTab=1`；修后两者均为`1/0`。这是跨路径语义回放，未冒称在Windows执行。主助手所述D独立候选926/927的精确失败堆栈尚未收到，不能据此宣布该独立项已关闭。
- 预览脚本新增`stage-e`入口和来源清单；保留A–D的209个fixture对象，追加186个，共395状态、25页。四宽双主题3160组合沿用原44px命中区、字号、裁切及网络/运行错误门禁，没有删减断言。逐页mode/kind/collection及不适用原因见[状态矩阵](MINIPROGRAM_0_5_0_STATE_MATRIX.md)。
- 网站`src/`、`public/`、共享tokens、API、集合、迁移、依赖及锁文件没有改动。

### 隔离数据与完整测试

实际使用仓库`rebuild-qa.mjs`的全新`native-integration`、`consent`、`post-edit`目录和三个合成PostgreSQL，端口分别55439、55614、55615，初始化前均不存在且端口空闲。runner只传递环境白名单，在快照设置空`.env` sentinel阻止向上加载真实环境，DB_PUSH=false，SMTP/S3/AI关闭，数据库和HTTP均在loopback。每个库实际执行17个迁移，测试自行创建所需合成记录；未复制生产库或读取凭据。

| 实际检查 | 结果 | 证据 |
| --- | --- | --- |
| 主Vitest，排除两个要求专用数据库的HTTP文件 | 88文件1580/1580，退出0，204.04秒 | `miniapp-050-stage-e-all-vitest.{json,log}` |
| 名片同意HTTP专库 | 1文件27/27，退出0 | `miniapp-050-stage-e-consent-http.{json,log}` |
| 原生POST改稿HTTP专库 | 1文件19/19，退出0 | `miniapp-050-stage-e-post-edit-http.{json,log}` |
| 全库文件覆盖核对 | 90文件1626项，无缺失、重复、失败、跳过或todo | `miniapp-050-stage-e-unit-summary.json` |
| 路径修复后定向复测 | 12/12，退出0；为上述1626的已变更文件复跑，不累加 | `miniapp-050-stage-e-path-fix-vitest.{json,log}` |
| 最终源码快照ESLint、TypeScript | 均退出0 | `miniapp-050-stage-e-lint.log`、`miniapp-050-stage-e-typecheck.log` |
| 原生源码及tokens检查 | 均退出0；25页、169文件、791806字节、外部依赖0、urlCheck开启 | `miniapp-050-stage-e-native-check.log`、`miniapp-050-stage-e-tokens.log` |

以上90个文件包含实际SQL权限、报名/回执与队伍/简介/荣誉合同。六个HTTP命名套件共78项，其中名片同意27和POST改稿19经过loopback HTTP服务器，其余32项使用真实Request/路由处理器、认证及SQL；不将全部78项描述为真实TCP请求。既有会话、迟到回调、未知写入、CAS、16题型、受控媒体和隐私测试均在1626内。网站代理额外147项是其独立构建快照的子集复核，不叠加总数。

三个root合成数据库已按持有记录优雅关闭；端口关闭、runner及PostgreSQL退出均有`miniapp-050-stage-e-root-processes.json`。原始失败/警告保留：schema保护负例的拒绝消息、PostgreSQL弃用警告均与测试失败区分。任何导出证据中的合成认证连接片段另行移除并记录，不提交数据库、登录态或环境文件。

### 网站构建、布局与发布范围

网站构建使用独立新快照和合成数据库，`next build --webpack`退出0，时间11:29:17.634–11:31:55.696 UTC，BUILD_ID为`ImVCLpxhwekhVNrOibJiz`。697个产物文件共27287132字节复制核对0差异。302个网站构建输入在root和三个快照一致，清单摘要为`e5597fde41c425a09bf2e52a1298388ef9cf2b5f848fe338283670f8c16e9299`。编译日志的`Compiled with warnings`提示保留，日志无具体警告正文。

本地`/health/live`、`/health/ready`、`/api/miniapp/status`均200且符合原合同。20路由×五宽×浅深共200个浏览组合通过，单main/H1、主题及meta正确，无横向溢出、运行异常或外部资源来源。完整网站业务、主题E2E和原生3160布局的最终结果仍待本轮汇总。

网站完整浏览器首轮使用系统Chromium154.0.8037.57，2失败、1中断、123未执行，退出130。原测试设置`Sec-Fetch-Site:same-origin`后，HTML仍200但同站JS/CSS出现`net::ERR_INVALID_ARGUMENT`；匿名只读对照确认默认头和普通测试头没有该错误。未替换Origin、扩大信任或删除安全断言，改用Playwright1.58.2锁定的Chromium145.0.7632.6/rev1208；短探针记录请求失败0、pageerror0，之后真实交互测试单独证明JS可执行。第一轮下载因隔离环境未继承网络代理而连接拒绝，第二轮仅为工具下载器传递既有代理/CA配置白名单后成功，没有输出配置值、安装系统依赖或改锁文件。

网站浅色专项首轮11项为8通过、3失败，退出1。其中主题矩阵达到原300秒上限；另外两项的社群空态被本轮新合成库中额外的`demo-game`演示记录干扰。原trace、35份截图/指标保留在本地，按实际原始轮次记录，不覆盖失败。已仅将自己播下的该演示游戏从published改为draft；后续保持原测试与超时参数复查。网站业务主轮另有在axe扫描/最后回执读取时达到原90秒上限的用例，等待低负载定点复查；不根据流程走到末尾就记为通过。

主题覆盖按代码区分：`club-theme`的7项实际读取主题参数，后续浅深分别记录；`club-visual`的4项使用默认浅色，不因轮次名称含dark而称为深色覆盖。200格浏览矩阵另有真实浅深各100格。截图交付保留首页、社群、代表队、活动的16张公共页面图；其余4张账号与4张含既有公开联系人文本的隐私页截图仅留本地，原24张生成记录不改写。

发布入口、AppID、版本覆盖、精确Git导入包、现有代码发布器的Node24.12/glibc2.36要求、preflight及健康/备份/恢复合同见[发布准备](MINIPROGRAM_0_5_0_RELEASE_PREPARATION.md)。本地Node24.19的合成构建不冒充代码发布器要求的生产构建证据。官方微信编译/原生点击、键盘/设备安全区、隐私SDK、媒体播放、真机、独立QA和生产发布均按各自实际证据记录，`releaseReady:false`。

### 最新指令：停止剩余验收，直接发布

用户明确要求“别管后面的验证与测试了，直接部署并上传微信0.5.0”。该指令覆盖前述等待独立QA/Windows/模拟器的发布门槛。收到后立即取消后续低负载复查、深色专项、历史同意网页专项及画廊检查，停止仍在运行的网站主轮并关闭自有测试服务；未继续扩大验收。

四个原生宽度进程在停止指令前已自然完成，均退出0：320px于12:17:33.507、375px于12:17:57.748、390px于12:18:05.852、430px于12:18:03.829 UTC完成。每宽790个，合计395状态×4宽×双主题3160组合；原报告的横溢出、过小热区、各类字号、裁切、运行异常和网络请求均0。仅汇总既有报告，没有追加布局、画廊或交互测试。原HTML与截图保留在`.data/miniapp-050-stage-e-width-{320,375,390,430}`。

网站Chromium145主轮按用户要求中断，实际为51通过、2超时失败、12条件跳过、1中断、60未运行，退出130；专项浅色维持8通过/3失败、退出1。原失败和剩余用例未复测，不将它们改为通过。200个独立网站浏览组合、1626项单元/SQL/HTTP、静态检查与完整构建保留各自已有范围。机器证据见[阶段E记录](evidence/miniapp-050-stage-e-20261015.json)。

客户端0.5.0源码与上传默认值已经齐备，按最新授权普通提交推送唯一默认`main`，不调用GitHub CI。微信上传由主助手安排Windows官方开发者工具执行，本环境没有调用微信工具，避免重复上传；正式审核和上线未请求。

服务器部署存在明确环境阻碍：当前云端没有`/home/agent/.ssh`或`/workspace/.ssh`配置，没有SSH代理环境，`/workspace/.aws`为空且未安装AWS CLI，已提供工具中没有服务器管理连接。GitHub既有认证可用，但不能代替服务器认证。未猜主机、读取私钥、生成凭据或改变任何生产服务。现有`.data/rebuild-qa-20261013/contracts/app/.next`是隔离QA配置的成功构建，BUILD_ID为`ImVCLpxhwekhVNrOibJiz`，不能直接冒充生产发布包；具备已有部署连接的执行方从最终main提交继续必要生产构建及存活检查。

原验证就绪字段仍为false，含义是检查清单未全完成；用户已明确授权直接发布，无需再次确认。后续只记录实际部署与0.5.0官方上传回执，不能把未执行的平台或生产操作写成成功。
