# new 分支部署与小程序 0.4.0 上传、预览

2026-10-15（北京时间）按用户本次授权完成本地同步、网站发布和原生小程序开发版上传及官方预览。执行证据见 [本轮记录](evidence/new-branch-release-20261015.json)。本轮授权覆盖历史阶段“不部署、不上传”的范围限制；分支仍只更新 `new`。

## 来源与本地保留

- 同步来源：`origin/new@dcbae1c8a2ed0571d55c417913fb5765cd9a7bee`。
- 应用发布提交：`c737d9c1ddeb63e42df6b84cc4384669f9518697`。相对同步来源，仅在 `next.config.mjs` 启用 `experimental.webpackBuildWorker`；本地生产构建、类型检查、lint 通过后正常推送 `new`。
- 工作目录：`C:\Users\Administrator\.codex\worktrees\new-release-20261014\zijingwebsite`，本地 `new` 跟踪 `origin/new`。
- 原目录 `D:\Users\16701\Documents\ChatGPT\zijingwebsite` 的 27 项未提交文件逐一摘要核对保持一致。`main`、`littleapp` 未合并或修改，无强制推送。

## 网站实际发布

入口为 [home.thuzijing.top](https://home.thuzijing.top)。运行目录 `/srv/zijingwebsite/releases/new-20261015-dcbae1c`，实际 `SOURCE_REVISION` 为 `c737d9c1ddeb63e42df6b84cc4384669f9518697`，Build ID 为 `amVNH2KnU_U8LHDG0SPci`。817 份提交文件与服务器源码逐字节摘要一致。

盘点发现原站实际运行于独立 `code-final` 目录，版本 `6f862c7bb876db658ab7c961bf55979cfa276482`；`/srv/zijingwebsite/app` 中的旧来源标记不能代表当时的运行版本。本轮通过 `systemctl show`、实际工作目录和构建标记核实并保留原发布目录。

服务器约 1.7 GB 内存。首轮构建触及 V8 内存上限；后续服务器构建受交换资源限制而停止，诊断保留，未把活动中的构建或默认 `Result=success` 算作成功。最终使用 Windows 本机完成的生产构建产物，在 Linux 服务器实际候选运行和线上浏览器验证后发布。构建包为 5,751,142 字节，SHA-256：

```text
3fb7abe17fcd99f83de5320671d749080398389fd776db679bf0da4966d0d937
```

此范围验证了本地构建及 Linux 运行兼容性，服务器上的完整编译未通过。构建期间临时调整的 swappiness 已恢复为原值 `0`；仅清理本轮失败构建缓存，保留日志、当前产物、旧发布和备份，服务器可用空间约 2.0 GB。

候选端口 3101 和正式 HTTPS 各执行 23 项路由/权限检查及 21 项 JS/CSS 资源请求，全部通过。ready 返回 200，声明 `club-operations-1`；小程序能力接口返回问卷版本 3、作答修改和社团运营版本 1。旧聊天、论坛、评论和互动 API 返回 404/no-store，私人集合匿名请求返回 401/no-store。

访客范围保持源码规则：首页跳转 `/events`；活动、通知、登录、注册可直接访问；社群、队伍、骨干招新、相册和账号页引导登录并保留 `returnTo`。首次候选检查中的“首页应为 200”断言按实际权限代码修正为 307 和精确目标，未放开访问权限。

线上 Chromium 在 1440 和 390 两种宽度各验证五个访问路径，共十项，均最终 200、单一 main H1、无横向溢出、无 pageerror；公开页面截图已人工查看。真实账号登录后的业务操作、邮件收件和完整线上业务回归未执行。

## 数据、服务与恢复

现有数据库已经登记全部 17 项迁移，本轮未执行生产迁移。发布前短暂停止网站写入并备份，在同机独立数据库恢复：69 张表、192 条记录逐表记录数和内容摘要一致。v3 媒体备份核验通过，实际图片镜像、本地视频、荣誉视频和隔离标记均为零文件；备份资料保留于受限服务器目录。

发布后再次比较全部 69 张表，业务和框架表均保持相同；数据库进程 PID `241884` 未改变。原环境文件、网站和 FreeKill Nginx 配置摘要保持一致，Nginx 校验通过。FreeKill [sgs.thuzijing.top](https://sgs.thuzijing.top) HTTPS 200、可信 TLS 和 `/ws` WebSocket 101 通过；实际游戏对局未执行。

恢复目录为 `/srv/zijingwebsite/backups/new-20261015-dcbae1c`，包括数据库备份、原 unit/drop-in、受限环境副本、配置和原发布标记。应用回退脚本为该目录的 `restore-previous-release.sh`，恢复原 1.1 发布目录并保留数据库和媒体。脚本已准备，发布后的回退未实际执行；异机备份沿用现状，尚未配置。

## 微信开发版与预览

- AppID：`wxccf9f8fc9515ebd5`；开发版版本 `0.4.0`。
- 静态检查：25 页面、162 文件、646,934 字节；共享生成内容一致，`urlCheck:true`。
- 官方开发者工具登录态核实成功。初次上传连接超时后恢复工具连接，最终上传退出 0，并生成新的官方上传结果：553,523 字节（约 540.5 KB）。
- 官方预览退出 0，生成新二维码和结果文件：553,525 字节。
- 二维码保存在忽略目录 `miniprogram/preview/preview.png`，另复制至 `D:\Users\16701\Downloads\zijing-miniapp-0.4.0-preview-20261015.png`。二维码和构建包均未提交 Git。
- 本轮 Automator 端点未连接成功，未将模拟器流程计作通过。手机扫码交互、平台后台配置、微信正式审核与公开发布未验证或执行。

## 检查边界与 CI

本地类型、lint、原生静态检查和最终生产构建均退出 0。首次 Windows 全量 Vitest 为 88 文件、1,478 通过、4 失败、90 跳过；七个套件要求专用合成数据库，其他失败涉及未预加载环境、Windows VM 路径与 POSIX 文件模式断言。本轮保留该失败结果。

随后以不含生产凭据的 Linux 合成环境执行三个相关测试文件，78/78 通过，覆盖原生荣誉消费、账号保留报告和预检环境拒绝；恢复本机隔离开发库和显式环境后，Payload 生命周期回归 1/1 通过。没有再跑一次完整 1,572 项，以上定向结果不改写原全量统计。

精确应用提交的 [CI run 38602807911](https://github.com/QShin21/zijingwebsite/actions/runs/38602807911) 为 failure，job 未分配 runner、steps 为零；GitHub annotation 明确为近期账户付款或支出额度阻止启动。未执行 CI 代码检查，未调整账单或额度。本轮验收使用上述实际本地与服务器结果；原阶段全量浏览器和合成测试记录按原提交、时间及范围保留。
