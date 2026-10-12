# 社团集成发布前预检 · 2026-10-12

本文件是当前现场的代码包、迁移 runner 和受控切换规划，尚未生成或验收正式发布包。初次源码读取起点为 `d46aab1`，现场规划复核读取 `ed952f8333ee2557402d911761297f2d45e055a3`，并采用父部署线程提供的生产事实。初始复核仅更新本文；根集成线程随后在隔离合成环境追加 CLI 入口对照测试。没有在本集成线程访问生产或凭据、执行生产迁移、清理或启停生产进程。

父线程已批准原生冻结 `58eb54277c01685e6fc19cd0e17218da965e3192`，根线程已合成 `f5502b62048f127afe53bbbf72f87d41846ceb46`；父线程报告注册、类型与迁移未产生新差异。简介 PUT 成功后 GET 失败的一致性窄补丁仍待冻结。代码包必须从包含最终获批冻结版本的**最终集成精确 SHA**重建并验收，不能改来源标记后复用早期构建。本文不构成正式发布声明。

## 父部署线程提供的现场事实

| 项目       | 只读事实                                                                                                        | 发布约束                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 网站       | `/srv/zijingwebsite/app` 无 `.git`；监听 `127.0.0.1:3100`                                                       | 通过文件/构建摘要核对来源；FreeKill 不在本次变更范围                                |
| 平台       | Linux x64、glibc 2.36、Node 24.12、Next 16.3.5、Payload 3.90.1                                                  | 当前云端为 glibc 2.41 / Node 24.19；云端构建通过不能宣称目标平台包已验收            |
| 容量       | 初次根盘 98%，约 1.06 GiB 可用；父部署线程获批清理后报告可用 **2.113 GiB**，无第二持久盘                           | 达到本轮 1.5 GiB 最低 / 2 GiB 建议预算，实际候选、备份、迁移/WAL与缓存峰值仍需核算 |
| app        | 清理前约 1.85 GiB；`node_modules` 919 MiB；`.next` 808 MiB，其中 cache 789 MiB                                  | 保留现有 app/依赖；不复制整套依赖或旧 app 来发布/回滚                               |
| PostgreSQL | 服务 17.10，DB 约 17.6 MiB；实际数据在 `app/.data/postgres`，运行二进制在 `app/node_modules`                    | **严禁整目录替换/删除 app，严禁替换、裁剪或删除现有依赖**，不能把数据目录当构建缓存 |
| PG 客户端  | 显式 `PG_BIN=/srv/zijingwebsite/tools/pg17/usr/lib/postgresql/17/bin`，版本 17.11；默认客户端 15.15             | 备份/恢复显式使用已核对的 17.11；不依赖默认 PATH，不在服务器安装                    |
| 依赖与配置 | 部署线程已将依赖/锁文件/Next 配置/迁移索引与其当时仓库核对                                                      | 最终候选仍要按 manifest 对复用依赖入口、原生文件及配置指纹复核                      |
| 来源与迁移 | `SOURCE_REVISION=cf96105a2382f6cf3bb57d8e736bf0e0990ed77a` 是混合现场旧标记；已应用 11 条迁移名单由部署线程保存 | 旧标记不能恢复实际混合现场；需将真实 11 条与最终候选 17 条逐名核对                  |
| 媒体       | 已读取范围约 4 KiB，限定树未见 `.showcase-videos`                                                               | 此结果不证明历史私有视频或永久标记不存在；仍按完整 v3 备份合同核查                  |

父线程另提供体积参考：a4 优化构建的 `.next/server` 约 16 MiB、`.next/static` 约 4.5 MiB，源码 `src` 约 6.8 MiB、`scripts` 约 128 KiB。当前仓库没有 `public` 目录。上述早期构建和源码体积仅用于设计，最终合成代码包及完整运行 manifests 的实际压缩/展开字节须重新计算，不能计为正式包已构建。

父部署线程随后报告用户已批准并完成仅 webpack 约 787 MiB 和网站专用 pnpm cache 约 293 MiB 两处清理，释放 1.055 GiB，现可用 2.113 GiB；网站、数据库和 FreeKill 均正常、PID 未变，没有重启/迁移/部署。此为父线程转交的执行事实，本集成线程没有执行生产清理，不因此获得其他目录清理授权。

## 本次选择：代码包与已核对依赖复用

优先制作压缩 **≤50 MiB**、展开 **≤100 MiB** 的代码包：保留现有 Next start 输出方式，在云端完成构建，只交付 `.next` 运行产物、源码/迁移/runner 入口、配置及对应静态资源。包中排除环境、数据、媒体、cache、备份、Git 和依赖。体积是目标与验收门槛，当前尚未测得实际包大小。

| 方案                         | 本次适用性     | 具体约束                                                                                                                          |
| ---------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 新候选代码目录，绑定现有依赖 | 优先           | 原 app、PG 数据和 PG 二进制保持原路径；新目录的 `node_modules` 受控指向 `/srv/zijingwebsite/app/node_modules`，记录并校验复用指纹 |
| 明确允许列表的文件级切换     | 备选           | 只切换经过清单审查的网站代码/构建/静态资源；保存旧网站运行文件及摘要；不得覆盖 `.data`、`node_modules`、环境、媒体或备份          |
| standalone 网页输出          | 本次不默认启用 | `next.config.mjs` 尚未启用 `output: 'standalone'`；只有单独审查配置、平台和完整产物后才可改选，仍须独立验收 CLI runner            |

删除或整体替换 `/srv/zijingwebsite/app`、解压归档覆盖整个 app、执行依赖 prune/install 或以新的 `node_modules` 覆盖旧目录，均不属于本方案。无需服务器 install/build，也不引入服务器 Docker/compose 或新数据库进程。

新候选目录只改变网站运行代码位置。部署线程先核对网站启动单元的实际工作目录与 pre/post 命令，确认切换不会从候选目录相对路径启动或停止 PG。不能在候选目录运行 setup/dev-db/db:stop 等脚本来启动另一份数据库。

## 可复现代码包与路径合同

从最终精确 SHA 导出干净源码，在隔离云端构建目录生成下列允许列表；最终归档与 manifest 不包含 `node_modules`，部署绑定另记入受控切换记录：

```text
candidate-code/
  SOURCE_REVISION
  release-manifest.json
  package.json, pnpm-lock.yaml, pnpm-workspace.yaml
  next.config.mjs, tsconfig.json
  .next/                         # 完整运行 manifests/server/static/BUILD_ID；无 cache/dev
  public/                        # 仅最终源码实际存在时携带；当前仓库无此目录
  src/                           # 包含 Payload 配置、实际导入源码、迁移索引/17条源码及快照
  scripts/backup.mjs
  scripts/club-operations-rollback-check.ts

# 部署线程后续受控绑定，非归档内依赖副本：
candidate-code/node_modules -> /srv/zijingwebsite/app/node_modules
```

少量完整 `src` 可用于保持 TS 配置导入链；不要为了省源码体积截断 collections/globals/lib 或必需资源。制作固定允许列表的 tar，固定文件顺序与归档时间/owner，记录归档和逐文件 SHA-256；在新空目录解压后复核大小、文件清单和摘要。构建工具产生的绝对临时路径必须经迁移目录后运行验证，不能依赖留在 builder 的源码或 pnpm store。

manifest 至少记录最终 SHA、构建配方和锁/配置摘要、构建与目标平台版本、代码文件摘要、压缩/展开字节、构建 ID、网页/runner 验证结果，以及复用依赖的固定路径和指纹。依赖指纹使用部署线程已核对的实际 package 解析版本、锁文件及关键 CLI/原生入口摘要；包清单不写秘密值。最终候选新增或改变依赖且与现场不匹配时停止切换，不能在服务器临时安装或替换 PG 所依赖的目录。

以下路径绑定必须在切换前核对：

- `DATABASE_URL` 保持受控的既有数据库连接，PG data 与二进制保持原绝对路径；改变网站 cwd 不得创建或改用候选目录的 `.data/postgres`。
- `MEDIA_DIR`、`MEDIA_BACKUP_SOURCE` 和 `BACKUP_DEST` 明确绑定核实过的绝对目录。Payload 和视频模块存在相对 `media` 回退，不能让新 cwd 静默生成空媒体目录。
- 沿用已核对的受限环境加载方式/环境文件绝对路径与原 `APP_ENV`，不把环境文件装进代码包或输出秘密；运行时精确 `SERVER_URL` 与构建时 `NEXT_PUBLIC_SERVER_URL` 一致于当前授权 origin。
- `.next/static` 与运行 manifests 来自同一构建，位于新代码根的正确位置；当前无 `public`，仅当最终源码出现该目录时随包保留对应资源，不能将不存在的目录当作归档必选项。部署线程只读核对网站代理是否直接映射旧 app 静态目录；若存在该映射，先审查并验证其网站范围切换，不能返回新页面却仍读取旧构建 chunk。
- Payload 配置的 `migrationDir=path.resolve('src/migrations')` 和 admin importMap baseDir 依赖 cwd，runner 要从明确的候选代码根运行；绑定已有依赖不代表允许沿用旧迁移目录。

文件级备选方案须列出每个允许切换的源码/配置路径，整体保持 `.next` 运行 manifests/server/static/BUILD_ID 一致，并将旧网站代码与构建运行部分保存为可核对的回退材料。保留大 cache 时可留在原目录或受控改名的旧构建目录，不把 rename 描述为已释放空间。不得用整目录同步、删除不在新清单的文件或 `--delete` 波及 PG/媒体/环境。

## 云端构建与 runner 验收

已阅读安装版本的 Next output/部署/环境变量文档。当前 `build` 为 `next build --webpack`，运行入口可直接使用 `node node_modules/next/dist/bin/next start`。现有 Docker runtime 复制完整 `/app`，现有 CI 上传 verification；两者都不是本次已验收代码包。当前云端 glibc 2.41 / Node 24.19 产物仅作候选，目标 Linux x64/glibc 2.36/Node 24.12 的验证尚未完成。

后续由根线程制作产物，在匹配目标的平台环境及等价、指纹匹配的依赖集合中验收；云端安装/构建仅使用合成隔离数据库与构建占位 secret。对最终包解压到新 cwd 后验证 Next 启动、后台与静态资产、ready、普通公开图片、私有 MP4 拒绝、授权 Range、永久标记读取错误失败关闭，以及实际 sharp/native 入口。服务器不编译、补依赖或运行构建。候选网页与最终冻结范围变更后重新验收，不以源码 CI 代报包验收。

**网页构建闭包不等于 CLI runner。**安装的 Payload 3.90.1 CLI 通过 `tsx/esm/api` 加载 TS 配置，生产依赖含 `tsx@4.22.4`；根项目另有开发依赖 `tsx@4.21.0`。CLI 读取 Payload 配置及动态迁移文件；`withPayload` 从网页 tracing 排除 `drizzle-kit`。本次 runner 复用现场既有依赖，须核对 Payload/tsx/esbuild/sharp 等实际入口，不能仅凭网页包启动成功判定迁移可运行。

以下为从验收过的候选代码根运行的入口示意，本线程没有执行。秘密仍由已确认的受控运行环境提供：

```sh
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
NODE_ENV=production DB_PUSH=false PAYLOAD_DROP_DATABASE=false PAYLOAD_CONFIG_PATH=src/payload.config.ts node node_modules/payload/bin.js migrate:status
NODE_ENV=production DB_PUSH=false PAYLOAD_DROP_DATABASE=false PAYLOAD_CONFIG_PATH=src/payload.config.ts node node_modules/payload/bin.js migrate
PG_BIN=/srv/zijingwebsite/tools/pg17/usr/lib/postgresql/17/bin node scripts/backup.mjs create
node node_modules/tsx/dist/cli.mjs scripts/club-operations-rollback-check.ts
```

迁移 status/up、全配置/17条迁移导入、重复 no-op、v3 合成备份/隔离恢复与回滚阻断仍须在最终 runner 和匹配依赖中独立验收。`migrate:status` 会初始化 Payload/数据库适配器，包括扩展初始化等行为，不是生产只读 catalog 探针；前置生产 schema 核对采用部署线程已有的只读通道。

根线程实测发现不能以 `payload run` 运行此回滚门禁：安装的 Payload 保留 `process.argv[1]` 为其 CLI 路径，脚本的自执行保护因此不进入 main。在仅剩一个永久标记的合成库，`payload run` 输出为空且退出 0；直接根项目 `tsx@4.21.0` CLI 输出完整不兼容报告并退出 1。设计改用上方直接 TSX 入口，实际现场必须核对该入口指纹与 Node 24.12 运行结果；云端验证版本为 Node 24.19。任何空输出、缺少 `checksComplete:true` 的完整 JSON 报告或不符场景的退出码，均不得计为门禁成功。保留现有依赖，不删除或裁掉该 TSX 入口；以后替换 runner 也须重做真假通过对照。

## 实际 schema、v3 备份与容量峰值

线上 `SOURCE_REVISION=cf96105…` 是混合现场旧标记，不能用于推断实际源码、依赖、构建或数据库，也不能只按该 SHA 重建回滚。现场旧网站运行文件/构建摘要与启动合同才是回退材料。部署线程保存的已应用 **11** 条迁移需与最终候选 **17** 条逐名、顺序和源码核对，同时只读核对实际表/列/外键/索引；不能只用 17−11 推定六条 pending 已确认。

runner 保留全部已审查历史迁移，只执行已核实 pending；相关增量尾部为 `20261011_180000 → 20261012_030000 → 050000 → 080000 → 160000 → 170000`。核心 160 TS blob 应为 `a47f81e6a8f62f596da3bb2808750216c114257d`，当前联合 170 快照含 69 表及荣誉四个 RESTRICT 外键。日志与现存结构不一致时先审查，禁止 DB_PUSH、重建库、凭猜测补日志、生成生产差异 DDL或执行 down/reset/refresh/fresh。

根盘无第二持久盘，发布峰值须基于获批两处清理后可用的 2.113 GiB 重新实测：

```text
所需增量 = 新代码根展开占用（目标≤100 MiB）
         + 传输临时占用（归档目标≤50 MiB）
         + 本次完整v3备份与回退网站运行文件占用
         + 迁移/WAL、网站运行缓存与日志余量
```

旧 app/PG/依赖继续占用，不能计作待释放空间；不复制整个 app 或 919 MiB 依赖做回退副本。保留旧网站**运行部分**的对应源码、构建/静态资源和摘要，按实际允许清单量取。可经既有通道流式传输到临时候选代码目录，结束后验证流与文件摘要，不切换半包。代码压缩/展开达标也不能代替备份峰值验收。容量不足保留旧站，等待父线程的具体处理授权；本轮两处清理不授权其他目录或业务资料清理。

DB 当前约 17.6 MiB、限定媒体树约 4 KiB 都不能直接作为完整备份体积。迁移前按既有备份授权暂停网站业务写入，用新版 `scripts/backup.mjs`、显式 PG_BIN 17.11 和核实过的绝对 BACKUP_DEST 生成受限 manifest v3：

- 保存全库 dump、各表内容摘要和数据库 dump 哈希，核对备份前后稳定；默认 15.15 客户端不适用。
- `media` 保存本地公开媒体或完成同步的 S3 对象镜像；`localVideos` 保存 `MEDIA_DIR/.showcase-videos`。
- `localHonorVideos` 保存 `MEDIA_DIR/.team-honor-videos`；`honorVideoReservations` 独立保存 `.showcase-videos/.team-honor-reserved` 的清单与原目录映射。
- 部署线程补齐历史路径、实际媒体绝对目录、私有目录/marker 权限与读取完整性核对；限定树未见目录不能代报历史视频不存在。任何当前或历史引用清零后仍保留永久标记。

本地模式有独立组件与 media 重复拷贝；脚本先生成完整备份再复制 BACKUP_REMOTE，异机复制不能省掉本地工作空间。本次无第二持久盘，不假定额外挂载或异机存储已可用。既有备份目标/留存策略也需核对，不把默认保留清理作为本轮获批空间措施。恢复与灾备验证使用独立受控副本，不覆盖运行中的 `app/.data/postgres`；备份、环境、私有媒体不进入 Git、公开 CI artifact 或代码包。

## 兼容回滚及未验收项

切换设计先保留现存网站运行材料及受控文件清单，PG/依赖/绝对环境和媒体路径不动。迁移或上线未完成且没有新业务写入时，只有明确兼容已扩展 schema 的旧运行文件才可回退；新业务开始后需预先验收的兼容回滚包，保留新版角色/私人答卷权限、骨干终态与历史回执、归档关闭 hook/同事务锁、唯一成员 getter、简介周期 HMAC 与私有媒体隔离。不得把混合现场旧标记 `cf96105…` 当作无条件回滚目标。

`280545a` 已补齐成立申请/招新批次/入队申请/成员/简介五表计数，任一非零设置 `requiresTeamCapabilities:true` 并阻断旧基线；club/staff/honor 与永久标记门禁继续保留，查询失败拒绝。零门禁结果仍不能证明实际回滚构建能力或生产 schema 兼容。含荣誉记录、私有文件或 marker 时不能回到缺少隔离保护的构建；不得删除数据或执行 down 来满足回滚门禁。迁移前备齐可运行的兼容回滚材料与恢复路径，避免失败后在服务器临时安装/编译。

仍待验收：最终包含获批原生及待冻结窄补丁的精确集成 SHA；≤50/100 MiB 实际代码包；目标平台与复用依赖指纹/CLI/网页验证；绝对 DB/MEDIA/env 与静态资源绑定；实际 11→17 迁移逐名/schema 核对；完整 v3 备份及磁盘峰值；具体兼容回滚包。以上未由本线程实际执行，源代码检查或云端高版本构建不能代报这些项目通过。
