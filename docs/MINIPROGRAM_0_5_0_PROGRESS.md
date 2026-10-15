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
