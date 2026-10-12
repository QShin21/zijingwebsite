# 社团集成发布前预检 · 2026-10-12

本文件是云端预构建与迁移 runner 的规划，尚未生成或验收正式发布包。本线程以仓库 `d46aab1d1f8f86269453bb6bd3d3c5abda6b29d0` 为读取起点，检查安装的 Next/Payload 源码，并随后只读核对根线程补齐的核心/简介回滚门禁；只新增本文件，没有连接生产、读取凭据、安装依赖、构建、执行迁移或启停进程。

父线程提供的线上信息：源码目录 `/srv/zijingwebsite/app` 无 `.git`；网站监听 `127.0.0.1:3100`；Node 24.12、Next 16.3.5、Payload 3.90.1、PostgreSQL 17.10；`SOURCE_REVISION=cf96105a2382f6cf3bb57d8e736bf0e0990ed77a`；磁盘仅约 **1.06 GiB** 可用。FreeKill 不在本次变更范围。CPU 架构、libc、实际媒体路径/容量、备份容量与挂载尚未传入，须由部署线程通过既有通道只读核实。

原生后续提交 `58eb542` / `cd337eb` 仍在独立审查与 CI，父线程明确暂不合入。当前仅规划网页总集成；后续批准并合入原生冻结版本后，必须针对**最终集成精确 SHA** 重新制作和验收瘦包，不能只改来源标记或复用较早构建。本文不构成正式发布声明。

## 已核对的仓库事实

| 入口                       | 当前行为                                                                                             | 对打包的影响                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `next.config.mjs`          | 使用 `withPayload`，没有 `output: 'standalone'`                                                      | 当前 `pnpm build` 不会自动得到可独立发布的 standalone 目录                                     |
| `package.json`             | `build` 为 `next build --webpack`；`start` 为 `next start`；`migrate` 为 `payload migrate`           | 网页构建与迁移是不同入口；运行机器可以直接调用包内 Node 入口，无需 pnpm/install/build          |
| `Dockerfile`               | Node 24.12.0-bookworm-slim；build 安装全部依赖；runtime 复制整个 `/app`                              | 运行层仍包含开发依赖、源码和构建缓存，现有镜像没有完成瘦包裁剪；不能据此估计会装入剩余磁盘     |
| `.github/workflows/ci.yml` | Node 24.12.0、冻结锁文件、迁移/检查/网页/构建；上传 verification                                     | 现有 CI 不产出可直接部署的网页包或 runner；源码 CI 通过不代表裁剪包的依赖闭包通过              |
| `src/payload.config.ts`    | TS 配置导入 collections/globals/lib、Lexical、S3、sharp；迁移目录为 `path.resolve('src/migrations')` | runner 要保留配置及其实际导入闭包，且从确定的包根目录执行                                      |
| 安装的 Payload CLI         | `bin.js` 通过 `tsx/esm/api` 加载；Payload 的生产依赖含 `tsx@4.22.4`；读取 TS 配置与动态迁移文件      | 不能删除 TS loader/esbuild/native 依赖；Payload CLI 的 tsx 不等同于根项目开发依赖 `tsx@4.21.0` |
| 安装的 `withPayload`       | Next tracing 排除 `drizzle-kit` / `drizzle-kit/api`；CLI 动态迁移导入刻意绕过 Next 静态分析          | **网页闭包不等于 CLI runner**；单独复制网页 trace 无法证明迁移入口完整                         |
| `scripts/backup.mjs`       | manifest v3；独立备份本地风采视频、私有荣誉视频和永久隔离标记                                        | 发布包不能代替备份，旧 v1/v2 清单不能替代含荣誉资料的 v3 备份                                  |

已阅读本安装版本的 `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`、部署及环境变量文档。Next 官方随包说明确认：standalone 可携带追踪依赖、使用 `server.js` 启动，无需目标机器安装 `node_modules`；`public` 与 `.next/static` 默认不自动复制，需要另外放入正确位置。原生依赖与动态文件仍需实际验收。

## 两种预构建方案

| 方案                                          | 云端准备                                                                                                                                                                                 | 服务器入口                                                                                       | 取舍与验收条件                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 当前源码可直接采用：`.next` + 生产依赖闭包    | 精确 SHA 的隔离副本中冻结安装、构建；在另一副本按锁文件裁剪生产依赖，保留原生模块与内部 pnpm 链接；打包完整 `.next` 运行产物、`public`、`next.config.mjs`、`package.json` 与 runner 源码 | `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100`                    | 延续已验证的 Next start。可去除构建 cache、测试/开发工具与 Git；生产依赖仍可能较大，必须测解压大小，不能宣称在 1.06 GiB 内可用             |
| 自动瘦包：standalone 网页包 + 独立 ops runner | 先单独审查并记录 `output: 'standalone'` 构建配置变更，再对最终 SHA 构建；复制 standalone 全目录、`public`、`.next/static`；另外制作 CLI/备份/回滚检查闭包                                | 网页用 `node server.js`，通过运行环境设置 `HOSTNAME=127.0.0.1`、`PORT=3100`；ops runner 单独执行 | 网页包通常更小，但当前仓库尚未启用。增加输出配置后必须重新验收产物；不能把较早默认构建改名当成 standalone，也不能从网页包直接假定 CLI 可用 |

先实际量取两类包的**解压后占用**再选择。若当前生产依赖方案满足全部峰值容量条件，可保持现有输出配置；不足时应先完成 standalone 配置与产物验收，或使用部署线程确认的独立存储。这里没有修改 Next/Docker/运行代码，也没有创建这两类包。

Docker 可在云端作为与目标平台匹配的 builder，最终交付 tar 包给现有原生 Node 服务。无需引入服务器 Docker、拉新数据库镜像或执行 compose build。不得更改 FreeKill、其他进程或全局运行环境。

## 产物合同与云端验收

采用现有 Next start 时，可将网页和 ops runner 放入同一 release 根，共享一份完整的生产依赖闭包，避免再复制一套 `node_modules`。根目录至少包含：

```text
release/
  SOURCE_REVISION
  release-manifest.json
  package.json
  next.config.mjs
  tsconfig.json
  node_modules/                  # 云端裁剪完成，含包内 native 二进制和有效内部链接
  .next/                        # 全部运行 manifests/server/static/BUILD_ID；不含构建 cache
  public/
  src/payload.config.ts
  src/collections/, src/globals/, src/lib/
  src/migrations/               # 审查过的完整迁移源码及索引/快照
  scripts/backup.mjs
  scripts/club-operations-rollback-check.ts
```

此树是最低入口清单，并非未经验证的文件白名单：配置导入还有其他源码/资源时必须保留。少量完整 `src` 可以留作 runner，不能为了省源码体积截断配置导入链。standalone 与 ops 分目录时分别记录各自闭包；不得通过链接指回云端 pnpm store、旧 app 或临时 builder 才运行。不会随发布包携带 `.env*`、凭据、媒体、数据库、备份、演示资料、Playwright 浏览器或安装缓存。

云端后续流程：

1. 从最终批准 SHA 导出干净源码，记录锁文件/构建配方摘要。使用经只读平台核对后与宿主兼容的 Linux 架构/libc；Node 24.12.0 为当前仓库 Docker/CI 的对齐版本。只使用隔离合成数据库与构建占位 secret，禁止取生产秘密构建。
2. 冻结安装与构建均在云端完成。`NEXT_PUBLIC_SERVER_URL` 在构建时固定；运行时必须按现有受控机制提供精确 `SERVER_URL`，并保留经部署线程确认的 `APP_ENV`，不会顺带把 staging 改成 production。
3. 在隔离副本裁剪依赖与构建缓存，保留 sharp/libvips、tsx/esbuild 等目标平台二进制及必需的传递依赖。不能按“看起来是开发工具”手工删除包。无需服务器安装、编译原生模块或补依赖。
4. 将**最终归档包**解压到独立目录，移除对完整 builder 的依赖后，使用合成已迁移数据库验证 Next 启动、后台登录/静态资产、ready、公开图片、私有 MP4 404、授权 Range 与永久标记失败关闭；验证原 native 模块加载及 media 路径。网页改造后的 tar 包必须重新跑这些检查，不能只引用源码测试。
5. 在同一裁剪产物里验证 CLI 找到 TS 配置、迁移文件全部导入、`migrate:status`、合成迁移一次与重复 no-op、v3 合成备份/隔离恢复、回滚检查成功和阻断场景。这一流程未由本线程运行。
6. manifest 记录精确 SHA、锁文件/配方与逐文件 SHA-256、Node/Next/Payload/目标架构/libc、压缩和解压字节、runner/网页验证结果及应用所需 schema。`SOURCE_REVISION` 来自 manifest，与实际文件一致；线上无 Git，通过清单与构建 ID 验证来源。

## 迁移 runner 与实际 schema 门禁

生产依赖闭包内可以直接使用既有 Payload CLI，省去服务器 pnpm 和根项目 tsx bin。以下是部署线程将来从**验收过的 release 根**运行的入口示意，本线程未执行：

```sh
NODE_ENV=production DB_PUSH=false PAYLOAD_DROP_DATABASE=false PAYLOAD_CONFIG_PATH=src/payload.config.ts node node_modules/payload/bin.js migrate:status
NODE_ENV=production DB_PUSH=false PAYLOAD_DROP_DATABASE=false PAYLOAD_CONFIG_PATH=src/payload.config.ts node node_modules/payload/bin.js migrate
node scripts/backup.mjs create
node node_modules/payload/bin.js run scripts/club-operations-rollback-check.ts
```

最后一项利用已安装 Payload 的 `run` 分支加载 TS 脚本；脚本本身仍读取受控运行环境，并执行只读 DB/媒体门禁。必须在最终 runner 的隔离验收中确认该入口，不能因源项目有 `pnpm club:rollback-check` 就假定裁剪后的根 tsx 命令仍在。`migrate:status` 会初始化 Payload/数据库适配器，适配器连接还包含扩展初始化等行为，不能把它当作生产只读 catalog 探针；前置 schema 核对采用部署线程既有的只读查询通道。PG 17 服务版本也不能证明已有 `pg_dump` / `pg_restore` 客户端：部署线程需只读确认兼容的 17+ 客户端及可执行路径，缺少时另在云端制作并验收其平台依赖闭包，无服务器安装。

`SOURCE_REVISION` 只描述来源。仓库该 `cf96105…` 对象的迁移索引仅含初始迁移，**不能据此推断线上只执行过初始迁移**，也不能据此重新运行旧建表 SQL。部署线程须先只读核对实际迁移日志、表/列/约束/索引与已知安装状态，给出真实 pending 名单；日志与现存结构不一致时停止迁移并审查，禁止以 `DB_PUSH`、重建库、补写未证明执行过的日志或强行跳过来消除差异。

runner 保留全部审查过的历史迁移，按实际日志只执行 pending；相关增量尾部为 `20261011_180000 → 20261012_030000 → 050000 → 080000 → 160000 → 170000`，不能截掉尚未核实的更早迁移。`080000` 先于核心；核心 160 TS blob 应为 `a47f81e6a8f62f596da3bb2808750216c114257d`；当前联合 170 快照包含 69 表及四个荣誉 RESTRICT 外键。不要从新模型生成生产差异迁移，禁止 down/reset/refresh/fresh。启动应用不会自动替代此受控迁移阶段。

## 1.06 GiB 磁盘、v3 备份与兼容回滚

部署线程须只读核对 `df` 的相关文件系统字节与 inode、现有 app/候选包/媒体/备份目录大小、媒体路径与权限、S3 镜像状态、备份目标是否真正是另一受控挂载，以及数据库 dump/迁移临时空间。arch/libc、客户端版本、服务实际工作目录/运行用户/环境加载方式和临时 loopback 端口也仍待核对；不输出秘密值。

发布前必须满足：

```text
可用空间 > 新 release 解压占用 + runner 额外占用 + 传输临时占用
           + 备份工作占用 + 数据库迁移/WAL与运行缓存余量
```

现有旧 app 已计入当前占用，必须保留；如果再做旧 app 全量副本，还要额外计入。不能用压缩包大小替代解压大小。可经既有传输通道流式解压到临时 release，完成后核对流摘要与逐文件摘要，再允许切换；或者使用已核实的另一文件系统保存归档与备份。容量不足时保留旧站、停止发布；不删除媒体、备份、旧产物或其他服务来挤空间。

迁移前按已有备份授权暂停网站业务写入，使用新版 `scripts/backup.mjs` 生成受限 v3 备份，保留全库 dump 与全表摘要，并核验源文件前后稳定。保持原绝对 `MEDIA_DIR`，不把它移进会替换或清理的 release。完整保留：

- `media`：本地公开媒体，或已完成同步的 S3 对象镜像；
- `localVideos`：`MEDIA_DIR/.showcase-videos`；
- `localHonorVideos`：`MEDIA_DIR/.team-honor-videos`；
- `honorVideoReservations`：`.showcase-videos/.team-honor-reserved`，即使当前 DB 引用清零也保留。

本地模式下这些文件会同时出现在 `media` 与独立组件中，备份峰值可能包含重复拷贝；既有脚本先生成本地完整备份再复制 `BACKUP_REMOTE`，配置异机复制本身不会消除本地空间需求。可先确认并指定有容量的 `BACKUP_DEST` 挂载。S3 模式下公开对象镜像与本地私有视频分别核对，不能只备份桶或只备份普通图片。备份不会进入 Git、公开 CI artifact 或网页包。

回滚分两层：迁移/上线未完成且没有新业务写入时，可在明确兼容现存 schema 的前提下保留旧应用入口；新业务开始后，须已有**兼容回滚构建**，保留新版角色/私人答卷权限、骨干终态与历史回执、队伍归档关闭钩子及锁、唯一成员权威、简介周期 HMAC 和媒体隔离。不能无条件启动 `cf96105…` 旧源码，也不能使用删除业务资料的 down 作为应用回滚。

根线程已补齐 `club:rollback-check` 的五个核心/简介表计数：成立申请、招新批次、入队申请、成员关系与成员简介；任一非零会设置 `requiresTeamCapabilities:true` 并阻止回到旧基线。原有 club/staff/honor 及永久标记门禁继续保留。其零结果仍不能代替对实际回滚构建能力、核心/简介权限合同和生产 schema 的核验；应在扩展 schema 的隔离恢复副本对选定回滚包做真实 HTTP 验收。任何荣誉记录、私有文件或永久标记非零，或门禁读失败，都不能回退到缺少视频隔离保护的构建。兼容包与恢复路径应在迁移前备齐，而非切换失败后在服务器安装或编译。新增门禁测试及 fresh CLI 的结果以根线程最终实测记录为准，本线程不代报通过。

本轮已核对的是源码入口和规划依赖。最终精确冻结版本、产物大小/平台/native/CLI/HTTP 验收、实际生产 migration 状态、完整备份及容量、兼容回滚包仍是后续发布条件；本线程没有把这些未执行项记为通过。
