# 部署、迁移与恢复

## 当前边界

现有测试站 https://test.yejiaxin.online 使用独立系统账户、systemd、Node 和 PostgreSQL 原生部署。2026-09-25 已更新应用提交 `9cc835b`，详细执行记录见 STATUS.md。当前仍为 staging、禁止搜索收录；Docker 容器验收及异机灾备不在此次部署验证范围。

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

反向代理：已有Nginx使用 `deploy/nginx.conf.example` 独立虚拟主机片段；新主机可参考 `deploy/Caddyfile`。替换明确占位、核对端口、证书与域名归属，先配置校验再按授权reload。不要覆盖旧站全局配置，不要修改其他服务。正式上线另需用户明确授权；本任务没有授权购买资源、DNS修改或生产发布。

生产设置 APP_ENV=production、DB_PUSH=false、HTTPS origin；使用独立生产数据库/秘密，禁止复制开发`.env`。运行 `pnpm preflight`，清理演示并确认隐私、负责人、邮件和备份。预览即便 NODE_ENV=production 也用 APP_ENV=staging，robots禁止收录。

直接托管时同时设置服务端 `SERVER_URL` 为运行环境的精确origin；它优先于构建时可能被内联的 `NEXT_PUBLIC_SERVER_URL`。Compose已将两者映射到同一配置值。

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
