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
