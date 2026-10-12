# 可复现社团代码包配方 · 2026-10-12

本配方只制作云端代码包，不连接生产、迁移数据库、启动网站或安装依赖。脚本是 scripts/create-club-code-release.mjs，仅使用 Node 内置模块及 Git、GNU tar、gzip。正式网页/runner/目标平台验收由根线程执行；打包成功只证明来源、文件与体积检查通过。

## 输入与目标平台

脚本接受三个位置参数：完整 40 位小写 Git commit SHA、已完成构建的目录、输出目录。拒绝 HEAD/分支/短 SHA；输出只能位于 /tmp 或 /workspace，拒绝越界链接和覆盖已有产物。构建与输出使用不同目录。

构建目录至少包含五个原始配置输入、.next 和 CLUB_BUILD_METADATA.json。源码通过 Git 精确对象导出，永不从当前工作树或构建目录复制 src。public 仅在该 commit 实际存在时导出；当前仓库没有 public。包内不复制 node_modules、原生依赖、环境、.data、媒体、备份、测试、docs、miniprogram 或 Git。源码仅允许五个根配置、完整 src 以及 backup.mjs / club-operations-rollback-check.ts；.next 完整保留运行文件，排除 cache/dev，拒绝 symlink、特殊文件和原生动态库。

目标是 Linux x64、glibc 2.36、Node 24.12。根线程使用 node:24.12.0-bookworm-slim builder 和只读既有依赖；本线程不执行 Docker 构建。打包脚本从 builder metadata 读取版本，拒绝缺失或不匹配的 tuple；不会把打包宿主 glibc 2.41 / Node 24.19 写成已匹配目标。metadata 必须由真正完成构建的 builder 生成，不能手填目标版本代替实际测量。

## builder metadata

先从最终批准完整 SHA 导出干净源码，设置 CLUB_BUILD_SOURCE_SHA 为该 SHA。云端 builder 使用合成隔离数据库/构建占位 secret、只读复用依赖，并完成既有 Next webpack 构建。以下片段在**同一 builder、构建根目录、构建成功以后**运行，仅创建 metadata；本线程未执行该构建：

    node --input-type=module <<'NODE'
    import fs from 'node:fs';
    import { createHash } from 'node:crypto';
    const sourceSHA = process.env.CLUB_BUILD_SOURCE_SHA;
    if (!/^[a-f0-9]{40}$/.test(sourceSHA || '')) throw new Error('Exact source SHA required');
    const inputs = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'next.config.mjs', 'tsconfig.json'];
    const inputsSHA256 = Object.fromEntries(inputs.map(file => [
      file, createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    ]));
    fs.writeFileSync('CLUB_BUILD_METADATA.json', JSON.stringify({
      schemaVersion: 1,
      sourceSHA,
      buildCompleted: true,
      buildID: fs.readFileSync('.next/BUILD_ID', 'utf8').trim(),
      builder: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        glibc: process.report.getReport().header.glibcVersionRuntime,
      },
      inputsSHA256,
    }, null, 2) + '\n');
    NODE

此文件不会将环境秘密装入包。打包同时核对 metadata 的 SHA、BUILD_ID、五个输入摘要与构建目录实字节/Git 对象；完整 .next 的文件列表和摘要在复制前后重复读取，变化即失败。builder source SHA 标签仍需由根线程的精确 Git 导出/构建流程保证，不是构建真实性的独立签名。

## 打包与重复哈希

在源码仓库使用已注入的最终完整 SHA 和明确的 /tmp 构建目录；以下路径仅为云端示例，不是生产路径：

    node scripts/create-club-code-release.mjs "$CLUB_BUILD_SOURCE_SHA" /tmp/club-final-build /tmp/club-code-run1
    node scripts/create-club-code-release.mjs "$CLUB_BUILD_SOURCE_SHA" /tmp/club-final-build /tmp/club-code-run2
    sha256sum /tmp/club-code-run1/*.tar.gz /tmp/club-code-run2/*.tar.gz

同一 Git SHA、.next 与同一 metadata 文件重复打包，tar.gz 摘要必须一致。归档使用固定 UTF-8 路径顺序、mtime 0、uid/gid 0、mode 0644、无 atime/ctime 的固定 PAX header 名；gzip -n -9 不记录输入名/时间。源文件 Git blob 也逐一核对，不能混入工作树修改。

输出：

- club-code-完整SHA.tar.gz：只包含代码、运行构建、SOURCE_REVISION 与 release-contract.json。
- club-code-完整SHA.manifest.json：完整逐文件 SHA-256/字节/模式、归档 SHA-256、压缩/展开字节、builder tuple、锁/配置摘要和兼容合同。

归档内 contract 不包含归档自身压缩字节；归档完成后外部 manifest 记录精确尺寸和 contract 自身摘要，避免把压缩尺寸写进自身产生循环依赖。manifest 与归档一起保留并验证，不能只传 tar.gz。压缩超过 50 MiB 或展开普通文件字节合计超过 100 MiB，会明确失败且不发布输出；展开字节不代表目标文件系统实际分配或发布峰值容量。

固定校验包括按顺序唯一的 17 条迁移源码/索引、160 TS blob a47f81e6a8f62f596da3bb2808750216c114257d、联合 69 表快照与荣誉四个 RESTRICT 外键。来源文件摘要记录 v3 备份、私有荣誉视频、永久 marker、队伍归档锁、成员权威和简介周期授权的代码证据。contract 的 HTTP、runner、production 验证始终保持 false，打包脚本不会把文件存在当成实际验收。

## 解包运行与迁移 runner

根线程将实际 tar.gz 解压到新空代码目录，核对 manifest 全部文件与归档摘要，绑定已核对指纹的现有 /srv/zijingwebsite/app/node_modules。保留 app/.data/postgres、实际 PG 二进制目录、受限环境与绝对 DB/MEDIA 路径；不整体替换/删除 app 或依赖，不运行服务器 install/build，不动 FreeKill。

验证对应 .next/static、运行 manifests 和条件 public 的服务位置，以及目标平台实际运行/native/HTTP 能力。源码 CI 或 metadata tuple 不能代替解包运行。PG_BIN 显式使用 /srv/zijingwebsite/tools/pg17/usr/lib/postgresql/17/bin（17.11），不使用默认 15.15。

**回滚门禁直接运行根 tsx CLI**，示意从候选代码根执行：

    node node_modules/tsx/dist/cli.mjs scripts/club-operations-rollback-check.ts

不要通过 Payload run 调用此脚本：已实测其 argv[1] 仍为 bin.js，脚本 main guard 可被跳过，产生退出 0 / 空输出。实际门禁验收必须同时核对：stdout 含非空、可解析的 JSON，checksComplete/compatibleWithBaseline 的明确布尔值，与退出码一致；marker-only 情况须兼容 false、隔离 true、退出 1。空输出或仅退出 0 都不能认定成功。

迁移 CLI 同样在匹配依赖与最终代码目录独立验收配置/全部 17 条迁移、合成一次 up 和重复 no-op。生产已应用 11 条名单仍需与候选逐名和实际 schema 核对；migrate:status 会初始化适配器，不能作为纯只读生产探针。实际 DB 不在本脚本的读取范围。

## 兼容回滚材料

根线程另以已成功 CI 的前一完整候选 `466b8b96b5d870fe053af7c6757cb82a8268b8da` 制作独立兼容回滚包，须通过相同目标平台/HTTP/runner 验证并保留全部能力。经过验证的代码包可以作为保留相同能力的兼容回滚材料，manifest 标注适用的扩展 schema 和保留新业务数据。此定义不承诺旧行为回退；需另记录具体网站入口/构建与受控文件切换材料。

禁止以混合旧标记 cf96105 为可运行旧基线，禁止 down/reset 或删除业务数据来回退。保留 v3 数据库与完整媒体备份、.team-honor-videos 和 .showcase-videos/.team-honor-reserved；记录清零也不清理永久 marker。父线程已转交获批两处缓存清理后的根盘可用 2.113 GiB；PG/依赖继续驻留旧 app，禁止额外清理或替换。包达标不替代实际容量峰值、备份与兼容 schema 验收。
