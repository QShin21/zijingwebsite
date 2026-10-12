# 可复现社团代码包配方 · 2026-10-12

本配方只制作云端代码包，不连接生产、迁移数据库、启动网站或安装依赖。打包脚本 scripts/create-club-code-release.mjs 与依赖指纹脚本 scripts/club-release-dependency-fingerprint.mjs 仅使用 Node 内置模块及 Git、GNU tar、gzip，并读取已只读绑定的现有依赖。正式网页/runner/目标平台验收由根线程执行；打包成功只证明来源、文件、确定指纹与体积检查通过。

## 输入与目标平台

脚本接受三个位置参数：完整 40 位小写 Git commit SHA、已完成构建的目录、输出目录。拒绝 HEAD/分支/短 SHA；输出只能位于 /tmp 或 /workspace，拒绝越界链接和覆盖已有产物。构建与输出使用不同目录。

构建目录至少包含五个原始配置输入、.next、CLUB_BUILD_METADATA.json 和 CLUB_DEPENDENCY_METADATA.json。源码通过 Git 精确对象导出，永不从当前工作树或构建目录复制 src。public 仅在该 commit 实际存在时导出；当前仓库没有 public。包内不复制 node_modules、原生依赖、环境、.data、媒体、备份、测试、docs、miniprogram 或 Git。源码仅允许五个根配置、完整 src 以及 backup.mjs / club-operations-rollback-check.ts；.next 完整保留运行文件，排除 cache/dev，拒绝 symlink、特殊文件和原生动态库。

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

## 实际依赖指纹

在同一匹配 Node 24.12 / Linux x64 / glibc 2.36 Docker 中，只读绑定既有 node_modules；root 指定最终完整 SHA。工具路径由根线程绑定，示例为 /tools，构建根为 /code：

    node /tools/club-release-dependency-fingerprint.mjs --source "$CLUB_BUILD_SOURCE_SHA" --root /code --output /code/CLUB_DEPENDENCY_METADATA.json

metadata 合同为 schemaVersion 1 / kind club-release-dependency-fingerprint，含 sourceSHA、rootPackageSHA256、rootDependencies、实测 runtime、entries、packages、resolutions、aliases、files、probes、pendingRunner 及 fingerprintSHA256。physical file 路径均相对于实际 node_modules realpath，去掉宿主 /workspace、Docker /code 或现场 /srv 等前缀；每个文件记录 SHA-256、bytes、所属包名/版本。指纹还保留模块解析上下文、请求 specifier、实际物理目标和文件 alias，逐项核对这些解析关系，不能只看文件还存在。

实际必需入口与闭包：

- 项目 package.json 的全部 dependencies 作为必须种子，逐项记录精确声明版本、实际物理 package manifest、包身份和可解析的根 API，并纳入递归运行/已安装 peer 闭包。pg/dotenv 根 API 必须存在；@payloadcms/next 没有根 API export，保留其 manifest，并记录源码使用的 auth、css、layouts、routes、rsc、views、withPayload 子入口。只解析路径、读取包文件，不 import 应用或配置。
- 根 tsx 的 dist/cli.mjs，与 Payload 自己解析的 tsx/esm/api 分开记录；Payload bin.js/API 及其声明运行依赖均核对，不能只签 .bin wrapper。
- Next dist/bin/next、Next API、SWC loader 与 Linux x64 GNU 的实际 .node；Native SWC 实测最小 TypeScript transform 和 parse，不采用会下载 fallback 的入口。
- Sharp loader、实际被加载的 Sharp .node，以及实际加载的 libvips .so 和 libvips 包文件闭包；合成 1×1 PNG 编码再读 metadata。
- 根 tsx 与 Payload tsx 分别解析的 esbuild API、Linux x64 实际 ELF 可执行与包闭包；执行版本检查及最小 transform。
- 根 tsx CLI --version 与 Next CLI --version，检查输出非空且版本正确。probe 采用无配置/秘密的临时 cwd 与最小环境，不调用 Payload --help/bin/config 或数据库。

完整声明运行依赖及已安装 peer 的所选平台闭包也逐文件记录；缺必需包、缺入口、外部解析、原生 probe 失败、运行 tuple 错误或不支持的 alias 均拒绝输出。验证器要求 rootDependencies 与实际根声明、精确版本、物理包及根解析关系全部匹配，缺任一种子的旧 metadata 拒绝。打包器将 rootPackageSHA256 绑定到精确 Git 导出的 package.json，并要求 metadata 的 sourceSHA/runtime 与 builder 完全一致，再用仓库当前实际 node_modules 逐路径核对解析、完整文件清单、所有 SHA/bytes 和包版本；新增本地 native 或解析换向同样不能默许。完整确定指纹及 metadata 摘要进入归档内 release-contract 和外部 manifest，不复制依赖。

此前根线程报告回滚 466 的匹配 Docker CLI/native 实测通过：136 包 / 23,486 文件，根 TSX/Next CLI、Sharp/libvips、SWC 原生 transform/parse、两套 esbuild 全部通过；该份 metadata 的自摘要为 056008e0dc9825870a486fc4d0c5f588610bc8be98231ba9730807d4a938bcf9。该旧闭包遗漏部分项目根 dependencies，当前合同已补齐全部根种子并拒绝此旧 metadata；最终候选与兼容回滚均须重新生成完整指纹、重复打包并验收，不能据旧结果宣称最终包完成。Payload 实际 bin/config/up、真正回滚门禁及网页仍在 pendingRunner 中，须从解包产物独立执行并验收。

## 打包与重复哈希

在源码仓库使用已注入的最终完整 SHA 和明确的 /tmp 构建目录；以下路径仅为云端示例，不是生产路径：

    node scripts/create-club-code-release.mjs "$CLUB_BUILD_SOURCE_SHA" /tmp/club-final-build /tmp/club-code-run1
    node scripts/create-club-code-release.mjs "$CLUB_BUILD_SOURCE_SHA" /tmp/club-final-build /tmp/club-code-run2
    sha256sum /tmp/club-code-run1/*.tar.gz /tmp/club-code-run2/*.tar.gz

同一 Git SHA、.next、同一 builder/dependency metadata 文件重复打包，tar.gz 摘要必须一致。归档使用固定 UTF-8 路径顺序、mtime 0、uid/gid 0、mode 0644、无 atime/ctime 的固定 PAX header 名；gzip -n -9 不记录输入名/时间。源文件 Git blob 也逐一核对，不能混入工作树修改。

输出：

- club-code-完整SHA.tar.gz：只包含代码、运行构建、SOURCE_REVISION 与 release-contract.json。
- club-code-完整SHA.manifest.json：完整逐文件 SHA-256/字节/模式、归档 SHA-256、压缩/展开字节、builder tuple、锁/配置摘要和兼容合同。

归档内 contract 不包含归档自身压缩字节；归档完成后外部 manifest 记录精确尺寸和 contract 自身摘要，避免把压缩尺寸写进自身产生循环依赖。manifest 与归档一起保留并验证，不能只传 tar.gz。压缩超过 50 MiB 或展开普通文件字节合计超过 100 MiB，会明确失败且不发布输出；展开字节不代表目标文件系统实际分配或发布峰值容量。

固定校验包括按顺序唯一的 17 条迁移源码/索引、160 TS blob a47f81e6a8f62f596da3bb2808750216c114257d、联合 69 表快照与荣誉四个 RESTRICT 外键。来源文件摘要记录 v3 备份、私有荣誉视频、永久 marker、队伍归档锁、成员权威和简介周期授权的代码证据。contract 的 HTTP、runner、production 验证始终保持 false，打包脚本不会把文件存在当成实际验收。

## 解包运行与迁移 runner

根线程将实际 tar.gz 解压到新空代码目录，核对 manifest 全部文件与归档摘要，绑定已核对完整确定指纹的现有 /srv/zijingwebsite/app/node_modules。必须逐项比较全部项目根 dependencies（含 db-postgres、email-nodemailer、@payloadcms/next、richtext、storage-s3、dotenv、pg）及 TSX/Payload/Next/SWC/Sharp/esbuild/libvips 的实际物理目标、解析关系、包版本及所有文件 bytes/SHA；任何不符即停止。保留 app/.data/postgres、实际 PG 二进制目录、受限环境与绝对 DB/MEDIA 路径；不整体替换/删除 app 或依赖，不运行目标 npm/pnpm install/prune/build，不动 FreeKill。

现场只读指纹核对还必须核对**现场实际运行平台**。下面假设部署线程已核实并注入 CLUB_CODE_MANIFEST / CLUB_CODE_ROOT，受控 helper 放在 /tools；传给 verifyDependencyMetadata 的最后参数从现场 Node 实测，不能复制 metadata.runtime：

    node --input-type=module <<'NODE'
    import fs from 'node:fs';
    import { verifyDependencyMetadata } from '/tools/club-release-dependency-fingerprint.mjs';
    const manifest = JSON.parse(fs.readFileSync(process.env.CLUB_CODE_MANIFEST, 'utf8'));
    const actualRuntime = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      glibc: process.report.getReport().header.glibcVersionRuntime,
    };
    await verifyDependencyMetadata(
      manifest.dependencies.fingerprint,
      fs.realpathSync(process.env.CLUB_CODE_ROOT),
      manifest.sourceSHA,
      actualRuntime,
    );
    console.log(JSON.stringify({ dependencyFingerprintChecked: true, actualRuntime }));
    NODE

云端 packager 在 Node 24.19 宿主只做依赖字节核对，比较的是 builder metadata tuple 与 probe tuple，不宣称宿主等于目标；实际 probes 已在 Node 24.12 Docker 执行。上面的现场检查必须使用现场 Node tuple，随后 Payload/门禁/网页实际解包运行仍各自验收。

验证对应 .next/static、运行 manifests 和条件 public 的服务位置，以及目标平台实际运行/native/HTTP 能力。源码 CI 或 metadata tuple 不能代替解包运行。PG_BIN 显式使用 /srv/zijingwebsite/tools/pg17/usr/lib/postgresql/17/bin（17.11），不使用默认 15.15。

**回滚门禁直接运行根 tsx CLI**，示意从候选代码根执行：

    node node_modules/tsx/dist/cli.mjs scripts/club-operations-rollback-check.ts

不要通过 Payload run 调用此脚本：已实测其 argv[1] 仍为 bin.js，脚本 main guard 可被跳过，产生退出 0 / 空输出。实际门禁验收必须同时核对：stdout 含非空、可解析的 JSON，checksComplete/compatibleWithBaseline 的明确布尔值，与退出码一致；marker-only 情况须兼容 false、隔离 true、退出 1。空输出或仅退出 0 都不能认定成功。

迁移 CLI 同样在匹配依赖与最终代码目录独立验收配置/全部 17 条迁移、合成一次 up 和重复 no-op。生产已应用 11 条名单仍需与候选逐名和实际 schema 核对；migrate:status 会初始化适配器，不能作为纯只读生产探针。实际 DB 不在本脚本的读取范围。

## 兼容回滚材料

根线程另以已成功 CI 的前一完整候选 `466b8b96b5d870fe053af7c6757cb82a8268b8da` 制作独立兼容回滚包，须通过相同目标平台/HTTP/runner 验证并保留全部能力。经过验证的代码包可以作为保留相同能力的兼容回滚材料，manifest 标注适用的扩展 schema 和保留新业务数据。此定义不承诺旧行为回退；需另记录具体网站入口/构建与受控文件切换材料。

禁止以混合旧标记 cf96105 为可运行旧基线，禁止 down/reset 或删除业务数据来回退。保留 v3 数据库与完整媒体备份、.team-honor-videos 和 .showcase-videos/.team-honor-reserved；记录清零也不清理永久 marker。父线程已转交获批两处缓存清理后的根盘可用 2.113 GiB；PG/依赖继续驻留旧 app，禁止额外清理或替换。包达标不替代实际容量峰值、备份与兼容 schema 验收。
