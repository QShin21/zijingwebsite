# 部署、迁移与恢复

## 2026-11-13 社群活动、平台角色和升推

北京时间 01:08:05，`main@856e0b3` 部署至 `home.thuzijing.top`，构建 `l40IsmMWILU4nU1M2Gzrf`。部署前创建本机数据库与媒体备份，四项增量迁移完成；迁移前后用户、角色、社群活动、风采、升推、骨干申请、活动报名、选座及临时上传记录数量一致。候选及正式服务就绪，公网首页、健康、构建资源和未登录的 10 MB 上传请求检查通过。小程序 0.5.18 已上传微信开发版，尚未提交审核；真机和线上登录态完整操作未核验。备份及回退脚本位于 `/srv/zijingwebsite/backups/publication-roles-20261113-856e0b3`；异机备份未配置。见[发布记录](evidence/publication-roles-deployment-20261113.json)。

## 2026-11-12 管理员逐座撤销选座

北京时间 20:40:07，`main@13ba540` 已部署到 `home.thuzijing.top`，构建 `fGATQ8zJXueQjIgjzF8Tt`。迁移 `20261112_070000_activity_seat_release` 新增逐座撤销记录表；迁移前备份与迁移后的申请、占用、凭证及未开放座位计数均为 130、228、178、23。公网就绪、活动页和构建清单返回 200。

服务器同机备份和应用回退脚本位于 `/srv/zijingwebsite/backups/seat-single-20261112-13ba540`。小程序 0.5.11 已上传开发版。详见[发布记录](evidence/activity-seat-single-release-deployment-20261112.json)。

## 2026-11-12 管理员撤销已确认选座

北京时间 20:33:47，`main@2250da6` 已部署到 `home.thuzijing.top`，构建 `eb7IF3uB0e2YzZ7PGpYT1`。新增迁移 `20261112_060000_activity_seat_revocation` 记录撤销人和时间；迁移前备份与迁移后的申请、占用、凭证及未开放座位计数均为 130、228、177、23。公网就绪、活动页和构建清单返回 200。

服务器同机备份和应用回退脚本位于 `/srv/zijingwebsite/backups/seat-revoke-20261112-2250da6`。小程序 0.5.10 开发版已上传。详见[发布记录](evidence/activity-seat-revocation-deployment-20261112.json)。

## 2026-11-12 待审核选座申请取消

北京时间 19:49:03，`main@b5707ff` 已部署到 `home.thuzijing.top`，构建 `YiHlCB83VjPvfMwJe7N9w`。新增迁移 `20261112_050000_activity_seat_cancellation` 记录取消时间；迁移前备份与迁移后的申请、占用、凭证及未开放座位计数均为 125、230、171、23。公网就绪、活动页和构建清单返回 200。

服务器同机备份和应用回退脚本位于 `/srv/zijingwebsite/backups/seat-cancel-20261112-b5707ff`。小程序 0.5.9 开发版已上传，含取消申请及修改申请请求兼容修复。详见[发布记录](evidence/activity-seat-cancel-deployment-20261112.json)。

## 2026-11-12 待审核选座申请修改

北京时间 19:39:58，`main@bf86300` 已部署到 `home.thuzijing.top`，构建 `ajZqV_Gz8oAI5cIXnuwwv`。新增迁移 `20261112_040000_activity_seat_revision` 为申请记录增加版本字段。迁移前备份与迁移后检查的选座申请、占用、凭证及未开放座位计数分别为 124、228、170、23。公网健康检查、活动页和构建清单返回 200。

服务器同机备份及应用回退脚本位于 `/srv/zijingwebsite/backups/seat-edit-20261112-bf86300`。微信开发者工具已上传 0.5.8 开发版，尚未提交审核。详见[发布记录](evidence/activity-seat-edit-deployment-20261112.json)。

## 2026-11-12 活动未开放座位

北京时间 17:56:37，`main@b002cf7` 已部署到 `home.thuzijing.top`，构建 `CwRcJ2O2oroQeRGYySeUZ`。增量迁移 `20261112_030000_activity_seat_blocks` 已登记；迁移前后的选座申请、占用和凭证计数分别保持 6、14、6。公网首页、活动页、小程序状态接口、健康检查和构建清单返回 200。

服务器同机备份位于 `/srv/zijingwebsite/backups/seat-lock-20261112-b002cf7`，该目录包含数据库与媒体备份及应用回退脚本。首次备份因目录权限失败后自动恢复旧服务，调整备份执行身份后完成发布。微信开发者工具已上传 0.5.7 开发版。详细范围见[发布记录](evidence/activity-seat-blocks-deployment-20261112.json)。

## 2026-11-12 网页社群图标入口

北京时间 16:41:46，`new@324b467` 已部署到 `home.thuzijing.top`，构建 `iPpEtsO3NwkGpYO1zhdC1`。首页和社群列表的卡片只提供浏览入口，图标编辑入口集中在社群页头。改动文件 lint、生产构建、隔离候选和公网就绪检查通过。应用沿用现有数据库结构，回退脚本为 `/srv/zijingwebsite/backups/community-card-entry-20261112-324b467/rollback.sh`。

## 2026-11-12 小程序默认游戏图标

北京时间 16:12:49，`new@ac32f08` 已部署到 `home.thuzijing.top`，构建 `541kHp3fQc20q2pdNbuzz`。五张默认图标已放入站点的媒体目录，公网请求返回 512 × 512 PNG，内容与发布文件一致。小程序 0.5.5 刷新首页或社群列表即可使用本站图标。

此版本沿用现有数据库结构。候选使用上一轮的隔离恢复库，上一版本及回退脚本保留在服务器。公网就绪、首页、后台登录页及小程序状态接口返回 200。见 [部署记录](evidence/miniapp-default-icons-deployment-20261112.json)。

## 2026-11-12 社群图标与后台改密

应用提交 `b1d7486b257b78b57bd4fc994da42dccfec02ce4` 于北京时间 15:51:55 部署到 `home.thuzijing.top`，运行构建为 `IsTigo95Y8jZwGzhxpi9h`。公网首页、后台登录页、小程序状态接口及两项健康检查均返回 200，静态资源清单与发布构建一致。

同机备份恢复核对 75 张表、4,748 条记录。隔离升级前后 74 张原有表的数据一致。线上应用 `20261112_020000_community_icons` 后，21 张业务表的 739 条记录和媒体核对一致。保留上一版本及回退脚本 `/srv/zijingwebsite/backups/icons-admin-reset-20261112-b1d7486/rollback.sh`，应用回退保留新增的图标数据。线上核验采用只读请求。见 [部署记录](evidence/icons-admin-reset-deployment-20261112.json)。

## 2026-11-12 历史发布：选座定时开放

应用提交 `fb020cd` 于北京时间 13:58:48 部署到 `home.thuzijing.top`。服务器恢复副本验证了开放前拒绝提交、到点开放和选座提交。线上核对 16 张业务表，包括既有选座申请、座位占用和凭证。小程序 0.5.4 已上传开发版。详见[发布记录](evidence/activity-seat-schedule-deployment-20261112.json)。

## 2026-11-12 历史发布：活动选座

应用提交 `d3a1446ee0677876cdea2e833a24d479ec047c8f` 于北京时间 13:27:14 部署到 `home.thuzijing.top`。公网返回了构建 `kk0HK-b4qmNuiNPdilfqE` 对应的资源，健康检查、社群活动选座状态和审核权限边界验证通过。完整选座、图片核验、驳回与通过流程在服务器恢复副本使用合成账号验证。

同机备份恢复核对 69 张表、3,963 条记录。增量迁移添加四张选座表，恢复副本的 68 张原业务表数据一致。正式库切换前后核对 12 张业务表，包括 278 份既有活动答卷。回退脚本位于 `/srv/zijingwebsite/backups/activity-seating-20261112-d3a1446/rollback.sh`。详见[部署记录](evidence/activity-seating-deployment-20261112.json)。小程序 0.5.3 的历史开发版上传见[上传记录](evidence/miniprogram-053-upload-20261112.json)。

## 2026-11-10 代表队招新发布与荣誉投稿入口

应用 `fafdf70f7548e414b81829fcd58986a7d95d1f8c` 于 21:26:41（北京时间）部署到 `home.thuzijing.top`，构建 `qOgziybwzndyDLLGO1uJG`。在隔离恢复库中验证了招新编辑、截止时间校验、正式发布、申请提交和录取，以及荣誉总档案、单队档案和队员投稿表单。公网返回了同一构建的资源清单，健康检查与登录边界核验通过。

同机备份恢复核对 69 张表、3,910 条记录。切换前后 16 张业务表的既有记录、迁移登记、媒体和网站配置校验一致。回退脚本位于 `/srv/zijingwebsite/backups/team-workflows-20261110-fafdf70/rollback.sh`。见[部署记录](evidence/team-workflows-deployment-20261110.json)。

## 2026-11-10 社群配图编辑与活动目录

应用 `c100b2e5754a6f82eba783b68fb25d516b0d18b7` 于 19:36（北京时间）部署，构建 `SsuCqFZ8WCqP2qUMpToJo` 先在备份恢复库和服务器候选端口验收。备份保存在 `/srv/zijingwebsite/backups/community-directory-20261110-c100b2e`，同机隔离恢复核验了 69 张表、3,632 条记录。切换沿用现有数据库结构，迁移登记一致，12 张业务表中的既有记录逐条一致。回退脚本位于备份目录中的 `rollback.sh`。详见[部署记录](evidence/community-directory-deployment-20261110.json)。

## 2026-11-10 网站发布配图

应用 `8c17547ab3a72d796d85f640ed0d7cb2f533bda6` 于 18:17（北京时间）部署到 `home.thuzijing.top`。构建 `UoKiJPLKwd1JG0tJ_1fLW` 在服务器隔离端口验证后切换。迁移只为活动、通知和活动报名问卷增加 8 个可空配图字段。

同机备份保存在 `/srv/zijingwebsite/backups/publish-images-20261110-8c17547`。69 张表、3,531 条记录恢复校验通过。隔离迁移后，迁移登记之外 68 张表的原有字段一致。正式库切换前后逐条对比 12 张业务表，226 份活动答卷、5 份骨干申请及相关内容的原有记录均一致。应用回退脚本为备份目录中的 `rollback.sh`，回退时保留增量列。异机备份未配置。详见[部署记录](evidence/publication-images-deployment-20261110.json)。

## 2026-11-09 首页升推与答卷邮箱

应用提交 `a30dbd3046440ffef00cf5abfb8016a0012c322e` 已部署至 `home.thuzijing.top`，运行目录 `/srv/zijingwebsite/releases/home-email-20261109-a30dbd3`，Build ID `xfx_YdDzDtyrppVhca3M3`。296 份源码和配置输入与提交一致；本机生产构建经服务器 3101 候选就绪、页面资源与权限检查后切换。服务器本机构建因响应变慢而停止，现有服务恢复后采用上述构建产物。

同机受限备份位于 `/srv/zijingwebsite/backups/home-email-20261109`，其数据库与媒体快照恢复到独立数据库后 69 张表、1,955 条记录一致。恢复副本核对 73 份活动答卷及 5 份骨干申请的账号邮箱全部匹配；正式切换前后五张相关表的已有记录和媒体摘要一致。本次未执行生产迁移；应用回退脚本位于该备份目录，未实际执行回退。异机备份未配置。详细检查与范围见 [部署证据](evidence/home-email-deployment-20261109.json)。

## 2026-10-15 原生0.5.0候选交付

用户最新要求停止后续验收，直接部署紫荆服务并上传微信0.5.0。源码在唯一默认`main`整合；现有隔离构建已完成，剩余测试已停止，未验证项继续保留。微信由主助手的Windows官方工具上传开发版，不提交正式审核或上线。

当前云端仅有已授权GitHub连接；`/home/agent/.ssh`和`/workspace/.ssh`均不存在，没有SSH代理环境，`/workspace/.aws`为空且无AWS CLI，也没有服务器管理连接工具。未猜主机、读取私钥或创建凭据，因此尚未从本环境部署服务器。现有Next产物来自隔离QA配置，不能直接当作生产发布包；接续方应使用最终main提交和既有部署配置执行必要构建及存活检查。不要再次扩大验收，保留数据库、媒体、环境与其他服务。详见[0.5.0进度](MINIPROGRAM_0_5_0_PROGRESS.md)与[发布入口](MINIPROGRAM_0_5_0_RELEASE_PREPARATION.md)。

## 2026-10-15 new 分支实际发布

网站已按本次授权运行应用提交 `c737d9c1ddeb63e42df6b84cc4384669f9518697`，运行目录 `/srv/zijingwebsite/releases/new-20261015-dcbae1c`，Build ID `amVNH2KnU_U8LHDG0SPci`。使用本机 Windows 生产构建，在 Linux 候选和线上验证后切换；服务器完整编译未通过。原 `app` 的来源标记属于旧部署，后续盘点先核实 systemd 实际工作目录。

本轮未执行生产迁移，现有 69 表全部摘要保持一致；备份在同机独立数据库恢复核验通过。受限恢复目录 `/srv/zijingwebsite/backups/new-20261015-dcbae1c` 保留旧发布/配置和 `restore-previous-release.sh`，发布后回退未执行，异机备份仍未配置。网站与 FreeKill 两个现有入口及代理配置保持，HTTPS/WSS 和访问边界检查通过。完整执行与未验范围见 [本轮发布](NEW_BRANCH_RELEASE_20261015.md)。下方为保留原时间和范围的历史记录。

## 2026-10-11 社团运营 1.1.0 候选边界

当前阶段在保存云环境完成扩展迁移、恢复、权限和网页流程，未变更生产。下方服务器账户、systemd 路径、APP_ENV 和 SHA 是历史部署记录，需要通过环境安全提供的既有通道重新核实，不能据此猜服务器或读取私钥。当前仅确认 GitHub 推送可用及网站 ready 200，尚无实际生产版本/备份现状证据。

迁移 `20261011_180000_club_operations` 保留 58 张历史表，新增任职和人工进群记录；生产禁止 DB_PUSH。独立恢复演练和最少权限回填通过，生产执行需按用户不可逆迁移边界单独停报。完整流程与回滚限制见 [版本说明](CLUB_OPERATIONS.md#部署与回滚)。旧 1.0 可能重新开放已撤销的名片/私人权限或不支持新流程，必须先运行 `pnpm club:rollback-check` 并核对兼容构建；禁止删表 down。

备份 manifest v2 总是分别保存 S3 对象镜像和 `MEDIA_DIR/.showcase-videos`，数据库内图片随数据库备份；恢复同时核验两类文件。`RESTORE_EVIDENCE_PATH` 可指定本轮独立证据，保留历史记录。S3 镜像同步、异机挂载及调度的真实配置尚未验证。Nginx 示例为 16 MB，与应用 12 MB 上传及 Next 14 MB 表单限制相容；真实代理配置仍需只读核验。新 ready 依赖报名/验证码/任职/进群结构及最新迁移登记，503 不输出私人内容或数据库错误。

## 历史部署基线（需重新核验）

现有网站入口为 https://home.thuzijing.top，FreeKill 入口为 https://sgs.thuzijing.top。网站使用独立系统账户、systemd、Node 和 PostgreSQL 原生部署，继续保持 staging、禁止搜索收录。2026-10-09 按用户要求撤下已停用的入口、跳转和证书续期配置；项目文档和验收记录中隐去历史入口名称，保留原验证时间和范围。Docker 容器验收及异机灾备不在此次域名清理验证范围。

## 2026-10-09 小程序接口

经用户单独授权，将 `littleapp` 提交 `42aa64d64b632f9e4ea206e070d34c04b02cf564` 的两份新增接口源码部署到现有网站。服务器独立构建、临时端口接口验证完成后切换；现有 102 份业务源码及依赖不变，未执行迁移。网站环境、Nginx 及相关配置摘要和数据库 / FreeKill 进程保持一致，网站就绪 200、FreeKill HTTPS 200 / WebSocket 101。

上一构建、源码、包配置及来源记录保存在 `/srv/zijingwebsite/backups/miniapp-20261009`，目录权限 `0700`。兼容应用回退脚本 `/srv/zijingwebsite/backups/miniapp-20261009/restore-miniapp.sh` 恢复旧构建及来源，仅移除本轮新增桥接源码，保留数据库、环境和媒体；脚本在发布前准备，旧构建实际存在。本轮未实际执行发布后的回退，未执行数据恢复。回退后原生邮箱 REST 登录可继续使用，昵称 / 验证码 / 互动桥接需重新部署。执行证据见 [miniapp-20261009.json](evidence/miniapp-20261009.json)。

## 独立部署

`Dockerfile` 为 Node 24 非 root 运行应用，附 pg_dump/pg_restore 17；`compose.yaml` 为独立项目名、数据库/媒体/备份卷。PostgreSQL 不映射宿主机端口；应用只绑定 `127.0.0.1:3100`，避免抢占其他站点。应用不会在每次启动时自动迁移。

取得测试环境授权后，用独立环境文件配置 APP_ENV=staging、POSTGRES_PASSWORD、PAYLOAD_SECRET、NEXT_PUBLIC_SERVER_URL（精确origin）。数据库密码建议随机十六进制，避免URI特殊字符。以下容器命令提供但本机未执行：

```sh
docker compose --env-file .env.deploy build
docker compose --env-file .env.deploy up -d db
docker compose --env-file .env.deploy run --rm app pnpm migrate
docker compose --env-file .env.deploy run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD app pnpm admin:create
docker compose --env-file .env.deploy up -d app
docker compose --env-file .env.deploy ps
```

验证 `/health/live` 和 `/health/ready`；就绪检查实际查询数据库且不输出凭据/堆栈。先上传测试图、创建测试记录，再重启服务并确认保留。仅在完成容器测试后允许把A26标为通过。部署时不要运行 `down -v`。

反向代理：已有 Nginx 使用 `deploy/nginx.conf.example` 独立虚拟主机片段；新主机可参考 `deploy/Caddyfile`。替换明确占位、核对端口、证书与域名归属，先配置校验再按当次授权 reload。不要覆盖旧站全局配置，不要修改其他服务。2026-10-09 用户已授权恢复现有服务域名，本次未改 DNS 或购买资源；后续正式内容上线及其他生产变更遵循当次授权范围。

生产设置 APP_ENV=production、DB_PUSH=false、HTTPS origin；使用独立生产数据库/秘密，禁止复制开发`.env`。运行 `pnpm preflight`，清理演示并确认隐私、负责人、邮件和备份。预览即便 NODE_ENV=production 也用 APP_ENV=staging，robots禁止收录。

直接托管时同时设置服务端 `SERVER_URL` 为运行环境的精确origin；它优先于构建时可能被内联的 `NEXT_PUBLIC_SERVER_URL`。Compose已将两者映射到同一配置值。

## 2026-10-09 服务域名与恢复

| 服务 | 当前入口 | 本次操作 |
| --- | --- | --- |
| 紫荆网站 | https://home.thuzijing.top | 独立 Nginx HTTPS 虚拟主机；运行时 origin 改为该入口 |
| FreeKill | https://sgs.thuzijing.top | 原入口保持运行；验证 HTTPS 与 WSS `/ws` |

两个服务子域名的 A 记录均已指向原服务器。主域名 `thuzijing.top` 本次盘点没有 A 记录，未调整 DNS。网站配置位于 `/etc/nginx/sites-available/zijing-home`；已移除停用入口的独立虚拟主机。网站沿用上传限制、反向代理端口 `127.0.0.1:3100`、关闭缓冲和 noindex 设置，`SERVER_URL` 与 `NEXT_PUBLIC_SERVER_URL` 均为 `https://home.thuzijing.top`。调整配置或构建后等待应用及可信 HTTPS 实际就绪。

home.thuzijing.top 的证书位于 `/etc/letsencrypt/live/home.thuzijing.top/`，当前有效期至 2027-01-07。已有 `certbot.timer` 和 Nginx 重载钩子继续负责两个当前入口的续期；实际执行 `certbot renew --cert-name home.thuzijing.top --dry-run --non-interactive --no-random-sleep-on-renew` 成功。HTTP 的 `/.well-known/acme-challenge/` 继续由 `/var/www/acme` 提供。停用入口的证书和续期条目已删除。

当前配置恢复目录 `/srv/zijingwebsite/backups/domain-retirement-20261009` 权限为 `0700`，保存当前网站环境、当前网站虚拟主机及基线摘要。环境文件包含秘密，仅保存在受限服务器目录；不复制到仓库。需要恢复当前入口配置时，以 root 执行：

```sh
/srv/zijingwebsite/backups/domain-retirement-20261009/restore-current-host.sh
```

脚本恢复当前网站环境和 `zijing-home` 虚拟主机，校验 Nginx 配置、重启网站并重载代理，最后等待应用就绪。此前域名切换的恢复脚本已改为调用此脚本，恢复流程仅使用当前授权入口。

使用 `eb5e9dea21406523bfc2190cbbaebaafac40fb21` 的干净工作分支源码重建线上应用，业务源码与原线上版本一致。临时 3101 端口验证后替换构建；当前运行文件扫描 670 个，遗留域名引用为零。网站环境、当前业务虚拟主机、FreeKill 配置与进程和数据库进程保持一致，未执行迁移。替换前构建及文档保存在上述受限恢复目录；恢复时仅保留当前业务入口。

当前入口重新验证了 13 个路由、CORS、两个证书的主机名和信任、登录表单无效账号分支、后台登录页面、手机布局及 FreeKill WebSocket 握手，详见 [域名清理证据](evidence/domain-retirement-20261009.json)。历史入口值已从 [域名恢复证据](evidence/domain-restoration-20261009.json) 隐去，不将历史测试改写为在当前入口进行。真实账号成功登录、邮件送达和实际游戏对局未在此次域名清理验证。

## 对象存储与邮件

未配置S3时使用 `MEDIA_DIR` 持久化目录。配置 S3_BUCKET/REGION/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY 后自动启用统一适配器；只使用专属公开媒体桶。对象存储ACL、区域、流量费用由负责人确认，实际供应商集成尚未验证。切换存储前备份并迁移原有对象，不能只改变量后删除旧文件。

SMTP_HOST/PORT/FROM/USER/PASSWORD 开启真实密码重置邮件。未配置时明确拒绝发送，不打印令牌。测试站已完成 163 SMTP 认证连接验证，实际邮件投递仍需页面请求和收件箱确认。生产配置有效发件身份、TLS和负责人恢复渠道。

## 迁移与回退

首个迁移在 `src/migrations/20260920_102916.ts`，对应可审查快照。修改模型后生成迁移、审查SQL、在隔离库应用和测试，再安排一次受控执行。生产禁止DB_PUSH。不允许未经授权执行破坏性迁移。

应用回退：保留上一构建镜像或提交，在与现有数据库模式兼容时回退应用。数据结构回退需针对具体迁移审查；存在删列/转换时应恢复备份并验证，不能承诺任意DOWN无损。恢复测试脚本不会drop现有库。

## 数据库与媒体备份

`scripts/backup.mjs` 使用 pg_dump custom 格式和媒体拷贝；manifest记录数据库SHA256、每张表记录数与内容SHA256、每个媒体文件SHA256。执行前暂停后台写入；脚本对比备份前后数据及文件，如有变化即失败，不生成可用manifest。备份包含账号哈希，必须按敏感资料保护。

Windows本机工具已放在忽略的 `.data/tools/pgsql/bin`；来自PostgreSQL官方指向的EDB 17.11二进制包。新机器安装PostgreSQL 17+客户端或设置PG_BIN。容器内PG客户端已在Dockerfile配置。

```sh
pnpm backup
pnpm restore:verify backups/实际生成的zijing目录
```

默认目录 `backups/`，保留14天；BACKUP_DEST、BACKUP_RETENTION_DAYS可配置。只清理备份根内命名符合zijing且存在manifest的过期目录，不触及其他目录。建议每日执行；可在Linux任务调度器中使用项目路径执行 `pnpm backup`，输出写入受限日志并接入运维告警（本轮未安装系统级定时任务）。

BACKUP_REMOTE可设为已挂载的异机受控目录；设置前由维护者核实该挂载真正位于另一主机并具备加密、配额和权限。当前未配置，不能声称异机保存已完成。S3模式要求先把对象同步到MEDIA_BACKUP_SOURCE，否则备份脚本拒绝省略媒体。

恢复演练新建 `zijing_restore_<时间>` 库，限制本地/隔离db主机且拒绝APP*ENV=production；从不覆盖已有库。媒体恢复到 `.data/zijing_restore*<时间>/media`；比较所有表内容和媒体哈希后生成 `docs/evidence/restore.json`。恢复库保留供检查。实际生产灾难恢复应先建立隔离替代环境、恢复、核对、冒烟验收，再获准切换连接和流量。

本次恢复记录：44张表、176条记录、1个媒体文件全部核验通过；这是本地演练，源库未修改。后续数据变化不影响这份历史演练结论。

## 2026-09-28 社群功能部署

应用提交 `3f81075f9e87bdf2c4dad1e08c95912ed0d691bb` 已更新到现有 staging 实例；数据、环境和媒体保留。备份位于 `/srv/zijingwebsite/backups/community-20260928`；三个增量迁移经过隔离恢复演练及线上原表摘要对比。数据库 systemd 启动完成后仍需 `pg_isready` 成功，才能执行迁移；第一次切换尝试因就绪等待不足退出并恢复旧站，补充等待后切换成功。

源码/旧构建保留在 `/srv/zijingwebsite/releases/community-previous-3f81075`，此版数据库为增量扩展。全量数据回退需停写、核验备份、按对应旧应用执行恢复，不能直接运行删表 down。现有测试站 Nginx `client_max_body_size` 为 `16m`，与 Next 14 MB 表单限制和最多六张图片匹配。其余虚拟主机配置不变。线上功能与清理验证见 `docs/evidence/deployment-community-spaces.json`。


## 2026-09-28 实时聊天与登录访问

应用提交 `22c85be88acce72829ae03cb3a3cd9f1927d3e52` 已部署至现有 `历史测试入口（已停用）` staging 实例，保持禁止收录。192 个源码文件逐一核验 SHA-256 与提交一致；服务器独立构建通过后切换。早期构建发生堆不足，代理改为本机会话接口校验并启用 Next.js 低内存编译；最终构建正常退出。

备份位于 `/srv/zijingwebsite/backups/realtime-20260928`，包含数据库快照、环境、媒体与源码。新增 `20260928_120000_chat_notifications` 只创建通知函数和触发器；隔离副本与线上迁移前后 56 张既有表内容摘要一致，保留 5 个账号和 2 条申请。旧源码和构建位于 `/srv/zijingwebsite/releases/realtime-previous-22c85be`，可恢复兼容旧应用；不需要删除业务数据或执行破坏性 down。

SSE 通过 Nginx 公网 HTTPS 验证，响应禁止缓冲，每 15 秒心跳、60 秒重新校验连接；断线重连后按 ID 补齐新增消息。临时 3101 端口还验证了代理对实际监听端口的会话查询。`SERVER_URL` 与运行环境保持原配置，未改 DNS、环境文件或 FreeKill 配置。验收数据见 `docs/evidence/deployment-realtime-community.json`。

## 2026-10-12 作答修改与新版小程序报名

应用 `00c485fe1e2ae538f556892429e08bfb49da1f46` 已部署至 `home.thuzijing.top`，无新增迁移。完整数据库、源码、媒体、环境和旧构建保存在 `/srv/zijingwebsite/backups/questionnaire-responses-mini-20261012`。完整 pg_restore 到隔离库后逐表核对 58 张表；候选 3101 端口用隔离账号完成新版 JWT 问卷提交/读取/PATCH/冲突/权限/关闭验证，测试对象已清理。线上 127 份源码、58 张表内容、媒体、私有环境、Nginx 和 FreeKill 配置/进程保留检查通过。

该备份目录的 `rollback.sh` 恢复旧应用和构建，保留现有生产数据库。旧版本支持信息组读取，但缺少本轮本人作答 PATCH；回退时需同步处理小程序修改入口与服务端能力。没有实际执行生产回滚。网站就绪 200，FreeKill HTTPS 200 / WebSocket 101，均检查可信证书；完整 CI、原生上传与验证边界见 [本次记录](QUESTIONNAIRE_RESPONSE_EDITING.md)。

## 2026-11-12 管理员增加申请座位

应用 `d67eb92d44fb2a21d079cd0c0c8c29fd1904b10c` 已部署，增量迁移 `20261112_080000_activity_seat_addition` 建立增加记录表。服务器本地备份与迁移后统计均为 131 份选座申请、225 个座位占用、178 个凭证和 23 个未开放座位；就绪及公网静态资源检查通过。备份保留在 `/srv/zijingwebsite/backups/seat-add-20261112-d67eb92`，本轮未执行恢复演练。详见[部署记录](evidence/activity-seat-addition-deployment-20261112.json)。

## 2026-11-12 点击座位查看申请

应用 `7bda1e51eabe25fb8b04b93d33fa0b1447a63da9` 已部署，无新增数据库迁移。服务器本地备份和切换前统计均为 131 份申请、225 个座位占用、178 个凭证和 23 个未开放座位。就绪及公网资源检查通过，备份在 `/srv/zijingwebsite/backups/seat-inspect-20261112-7bda1e5`；本轮未执行恢复演练。详见[部署记录](evidence/activity-seat-inspection-deployment-20261112.json)。

## 2026-11-12 座位详情直接处理申请

应用 `f9500c890b962c1b5e9c7cdc61114e3f4d88404d` 已部署，无新增数据库迁移。服务器本地备份和切换前统计均为 131 份申请、227 个座位占用、178 个凭证和 21 个未开放座位。公网就绪及资源检查通过，备份在 `/srv/zijingwebsite/backups/seat-actions-20261112-f9500c8`；本轮未执行恢复演练。详见[部署记录](evidence/activity-seat-map-actions-deployment-20261112.json)。

## 2026-11-12 管理员更换申请座位

应用 `6f17453d8e55d7d27a9bfe005f95e5a082e3d6ea` 已部署，无新增数据库迁移。服务器本地备份和切换前统计均为 131 份申请、227 个座位占用、178 个凭证和 21 个未开放座位。公网就绪及资源检查通过，备份在 `/srv/zijingwebsite/backups/seat-change-20261112-6f17453`；本轮未执行恢复演练。详见[部署记录](evidence/activity-seat-change-deployment-20261112.json)。

## 2026-11-12 自主选座与随机座位

应用 `ba3721d2b8d78c7bcb7bdaa6db2466ef276ab3f2` 已部署，迁移 `20261112_090000_activity_seat_modes` 新增模式和申请数量字段。迁移前后核对原有申请、设置、占座、锁座及凭证内容一致，原有活动均为自主选座；备份和迁移后均有 133 份申请、231 个座位占用、180 个凭证和 21 个未开放座位。公网就绪及资源检查通过，服务器本地备份在 `/srv/zijingwebsite/backups/seat-random-20261112-ba3721d`；本轮未执行恢复演练。备份内的应用回滚脚本会在存在随机模式活动或随机待审申请时拒绝切回旧应用，以免旧应用无法正确处理新状态。详见[部署记录](evidence/activity-seat-random-mode-deployment-20261112.json)。

## 2026-11-12 活动详情图片排版

应用 `f7d4f3aeb1de2b91fcba432d11532fe3f5c07c50` 已部署，无新增迁移。候选端口及公网就绪、活动列表和构建资源检查通过，公网活动详情样式文件与构建产物的 SHA-256 一致。服务器本地备份和回退脚本位于 `/srv/zijingwebsite/backups/event-images-20261112-f7d4f3a`；本轮未执行恢复演练。登录后的真实活动详情未做视觉核验。详见[部署记录](evidence/event-images-layout-deployment-20261112.json)。
