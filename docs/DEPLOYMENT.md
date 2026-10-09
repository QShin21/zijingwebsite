# 部署、迁移与恢复

## 当前边界

现有网站入口为 https://home.thuzijing.top，使用独立系统账户、systemd、Node 和 PostgreSQL 原生部署。2026-10-09 按用户授权恢复原有域名，线上应用继续为 `eb0a236963224abe30ac32d06cd42900b6b279cd`；旧 https://test.yejiaxin.online 以 308 跳转到新入口，保留路径和查询参数。当前仍为 staging、禁止搜索收录；Docker 容器验收及异机灾备不在此次域名恢复验证范围。

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

## 2026-10-09 域名恢复与回滚

| 服务 | 当前入口 | 本次操作 |
| --- | --- | --- |
| 紫荆网站 | https://home.thuzijing.top | 独立 Nginx HTTPS 虚拟主机；运行时 origin 改为该入口 |
| FreeKill | https://sgs.thuzijing.top | 原入口保持运行；验证 HTTPS 与 WSS `/ws` |
| 旧网站地址 | https://test.yejiaxin.online | HTTP / HTTPS 308 跳转，保留路径与查询参数 |

两个服务子域名的 A 记录均已指向原服务器。主域名 `thuzijing.top` 本次盘点没有 A 记录，未调整 DNS。网站配置位于 `/etc/nginx/sites-available/zijing-home`，旧域名跳转位于 `/etc/nginx/sites-available/zijing-test`。新站沿用上传限制、反向代理端口 `127.0.0.1:3100`、关闭缓冲和 noindex 设置；只修改环境中的 `SERVER_URL` 与 `NEXT_PUBLIC_SERVER_URL`，重启网站服务并等待应用及新域名可信 HTTPS 就绪。

home.thuzijing.top 的证书位于 `/etc/letsencrypt/live/home.thuzijing.top/`，当前有效期至 2027-01-07。已有 `certbot.timer` 和 Nginx 重载钩子继续负责续期；实际执行 `certbot renew --cert-name home.thuzijing.top --dry-run --non-interactive --no-random-sleep-on-renew` 成功。HTTP 的 `/.well-known/acme-challenge/` 继续由 `/var/www/acme` 提供，旧域名也保留验证路径与证书。

回滚目录 `/srv/zijingwebsite/backups/domain-20261009` 权限为 `0700`，包含原网站环境、旧网站虚拟主机、FreeKill 配置副本、基线摘要和 `rollback.sh`。原环境文件包含秘密，仅保存在受限服务器目录；不复制到仓库。需要回滚时，以 root 执行：

```sh
/srv/zijingwebsite/backups/domain-20261009/rollback.sh
```

脚本恢复旧网站环境和虚拟主机，核对新虚拟主机路径后移除本次新增入口，校验 Nginx 配置、重启网站并重载代理，最后等待应用就绪。新签发证书会保留供后续使用。第一次即时 HTTPS 验证仍读取到旧默认站点证书，触发自动回滚；该恢复路径已实际执行，旧网站健康检查恢复正常。补充 Nginx 重载后的 HTTPS 重试，再次切换成功。

本轮没有替换应用构建、执行数据库迁移、导入演示资料或修改 FreeKill。核验其他虚拟主机、全局 Nginx、FreeKill 配置与进程和数据库进程一致。公网验证涵盖 13 个路由、五项 HTTP / HTTPS 跳转、新域名 CORS、登录表单无效账号分支、后台登录页面、手机布局及 FreeKill WebSocket 握手；真实账号成功登录、邮件送达和实际游戏对局未在本轮验证。脱敏证据见 [domain-restoration-20261009.json](evidence/domain-restoration-20261009.json)。

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

应用提交 `22c85be88acce72829ae03cb3a3cd9f1927d3e52` 已部署至现有 `https://test.yejiaxin.online` staging 实例，保持禁止收录。192 个源码文件逐一核验 SHA-256 与提交一致；服务器独立构建通过后切换。早期构建发生堆不足，代理改为本机会话接口校验并启用 Next.js 低内存编译；最终构建正常退出。

备份位于 `/srv/zijingwebsite/backups/realtime-20260928`，包含数据库快照、环境、媒体与源码。新增 `20260928_120000_chat_notifications` 只创建通知函数和触发器；隔离副本与线上迁移前后 56 张既有表内容摘要一致，保留 5 个账号和 2 条申请。旧源码和构建位于 `/srv/zijingwebsite/releases/realtime-previous-22c85be`，可恢复兼容旧应用；不需要删除业务数据或执行破坏性 down。

SSE 通过 Nginx 公网 HTTPS 验证，响应禁止缓冲，每 15 秒心跳、60 秒重新校验连接；断线重连后按 ID 补齐新增消息。临时 3101 端口还验证了代理对实际监听端口的会话查询。`SERVER_URL` 与运行环境保持原配置，未改 DNS、环境文件或 FreeKill 配置。验收数据见 `docs/evidence/deployment-realtime-community.json`。
