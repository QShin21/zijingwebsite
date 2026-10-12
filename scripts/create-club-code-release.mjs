#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createReadStream, createWriteStream, constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MiB = 1024 * 1024;
const maximumCompressedBytes = 50 * MiB;
const maximumExpandedBytes = 100 * MiB;
const inputFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "next.config.mjs",
  "tsconfig.json",
];
const sourcePaths = [
  ...inputFiles,
  "src",
  "scripts/backup.mjs",
  "scripts/club-operations-rollback-check.ts",
];
const expectedMigrations = [
  "20260920_102916",
  "20260924_133459",
  "20260924_134008",
  "20260926_145257_nickname_login",
  "20260927_004500_application_details",
  "20260927_181509_community_reactions",
  "20260927_181800_forum_curation",
  "20260927_182940_community_showcase",
  "20260928_120000_chat_notifications",
  "20260929_010000_chat_images",
  "20261011_160000_activity_signups",
  "20261011_180000_club_operations",
  "20261012_030000_content_promotions",
  "20261012_050000_staff_recruitment",
  "20261012_080000_team_honor_records",
  "20261012_160000_team_core",
  "20261012_170000_team_member_profiles",
];
const coreMigrationPath = "src/migrations/20261012_160000_team_core.ts";
const coreMigrationBlob = "a47f81e6a8f62f596da3bb2808750216c114257d";
const snapshotPath = "src/migrations/20261012_170000_team_member_profiles.json";
const target = { node: "24.12", platform: "linux", arch: "x64", glibc: "2.36" };
const childEnv = { ...process.env, LC_ALL: "C", TZ: "UTC" };
delete childEnv.TAR_OPTIONS;
delete childEnv.GZIP;
delete childEnv.POSIXLY_CORRECT;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const gitBlob = (bytes) =>
  createHash("sha1")
    .update("blob " + bytes.length + "\0")
    .update(bytes)
    .digest("hex");
const sort = (items) =>
  items.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
const within = (root, candidate) =>
  candidate === root || candidate.startsWith(root + path.sep);
const at = (root, relative) => path.join(root, ...relative.split("/"));
const stringify = (value) => JSON.stringify(value, null, 2) + "\n";
async function command(binary, args) {
  return (await exec(binary, args, { env: childEnv, maxBuffer: 4 * MiB }))
    .stdout;
}

async function outputDirectory(value) {
  const requested = path.resolve(value);
  const roots = ["/tmp", "/workspace"];
  if (!roots.some((root) => within(root, requested)))
    throw new Error("Output directory must be within /tmp or /workspace");
  const physicalRoots = await Promise.all(
    roots.map((root) => fs.realpath(root)),
  );
  let ancestor = requested;
  for (;;) {
    try {
      await fs.lstat(ancestor);
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      ancestor = path.dirname(ancestor);
    }
  }
  const physicalAncestor = await fs.realpath(ancestor);
  if (!physicalRoots.some((root) => within(root, physicalAncestor)))
    throw new Error("Output directory resolves outside /tmp or /workspace");
  await fs.mkdir(requested, { recursive: true });
  const physical = await fs.realpath(requested);
  if (!physicalRoots.some((root) => within(root, physical)))
    throw new Error("Unsafe output directory");
  return physical;
}

function safeRelative(relative) {
  const parts = relative.split("/");
  const hasControlCharacter = [...relative].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (
    !relative ||
    relative.startsWith("/") ||
    relative.includes("\\") ||
    hasControlCharacter ||
    parts.some((part) => part === "..")
  )
    throw new Error("Unsafe artifact path");
  if (
    parts.some(
      (part) =>
        part.startsWith(".env") ||
        [".git", ".data", "node_modules"].includes(part),
    )
  )
    throw new Error("Forbidden secret, data or dependency path: " + relative);
  if (/\.(?:node|so(?:\.\d+)*|dll|dylib)$/i.test(relative))
    throw new Error("Native dependencies cannot be included: " + relative);
}

async function tree(root, prefix = "", excludeNextCaches = false) {
  const files = [];
  for (const entry of await fs.readdir(at(root, prefix), {
    withFileTypes: true,
  })) {
    if (
      excludeNextCaches &&
      prefix === "" &&
      ["cache", "dev"].includes(entry.name)
    )
      continue;
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    safeRelative(relative);
    const info = await fs.lstat(at(root, relative));
    if (info.isSymbolicLink())
      throw new Error("Artifact input contains a symlink: " + relative);
    if (info.isDirectory()) files.push(...(await tree(root, relative)));
    else if (info.isFile()) files.push(relative);
    else throw new Error("Artifact input contains a special file: " + relative);
  }
  return sort(files);
}

async function fingerprint(root, relatives) {
  const result = {};
  for (const relative of sort([...relatives])) {
    const bytes = await fs.readFile(at(root, relative));
    result[relative] = {
      sha256: sha256(bytes),
      bytes: bytes.length,
      mode: "0644",
    };
  }
  return result;
}

async function compress(input, output) {
  const child = spawn("gzip", ["-n", "-9", "-c", input], {
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let errorText = "";
  child.stderr.on("data", (chunk) => {
    errorText += chunk.toString();
  });
  const completed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("gzip failed: " + errorText.trim())),
    );
  });
  await Promise.all([
    pipeline(
      child.stdout,
      createWriteStream(output, { flags: "wx", mode: 0o600 }),
    ),
    completed,
  ]);
}

async function main() {
  const [sourceSHA, buildArgument, outputArgument, ...extra] =
    process.argv.slice(2);
  if (
    !/^[a-f0-9]{40}$/.test(sourceSHA || "") ||
    !buildArgument ||
    !outputArgument ||
    extra.length
  )
    throw new Error(
      "Usage: node scripts/create-club-code-release.mjs <40-character-git-SHA> <completed-build-directory> <output-directory>",
    );
  const resolved = (
    await command("git", [
      "-C",
      repo,
      "rev-parse",
      "--verify",
      sourceSHA + "^{commit}",
    ])
  ).trim();
  if (resolved !== sourceSHA)
    throw new Error("Source must be an exact commit SHA");
  const build = await fs.realpath(path.resolve(buildArgument));
  const output = await outputDirectory(outputArgument);
  if (within(build, output) || within(output, build))
    throw new Error("Build and output directories must be separate");
  const metadataBytes = await fs.readFile(
    path.join(build, "CLUB_BUILD_METADATA.json"),
  );
  const metadata = JSON.parse(metadataBytes);
  const buildID = (
    await fs.readFile(path.join(build, ".next/BUILD_ID"), "utf8")
  ).trim();
  if (
    metadata.schemaVersion !== 1 ||
    metadata.sourceSHA !== sourceSHA ||
    metadata.buildCompleted !== true ||
    metadata.buildID !== buildID ||
    !/^[a-zA-Z0-9._-]{1,200}$/.test(buildID)
  )
    throw new Error("Completed build metadata/source SHA/BUILD_ID mismatch");
  const builder = metadata.builder;
  if (
    !builder ||
    !/^v24\.12\.\d+$/.test(builder.node || "") ||
    builder.platform !== target.platform ||
    builder.arch !== target.arch ||
    builder.glibc !== target.glibc
  )
    throw new Error(
      "Builder metadata must report Linux x64/glibc 2.36/Node 24.12; packaging-host versions are not builder evidence",
    );
  if (!metadata.inputsSHA256 || typeof metadata.inputsSHA256 !== "object")
    throw new Error("Build metadata requires five input digests");
  const destinationArchive = path.join(
    output,
    "club-code-" + sourceSHA + ".tar.gz",
  );
  const destinationManifest = path.join(
    output,
    "club-code-" + sourceSHA + ".manifest.json",
  );
  for (const destination of [destinationArchive, destinationManifest]) {
    try {
      await fs.lstat(destination);
      throw new Error("Refusing to overwrite release output: " + destination);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const work = await fs.mkdtemp(path.join(output, ".club-code-work-"));
  const stage = path.join(work, "code");
  const createdOutputs = [];
  try {
    await fs.mkdir(stage);
    const rawTree = await command("git", [
      "-C",
      repo,
      "ls-tree",
      "-r",
      "-z",
      sourceSHA,
      "--",
      ...sourcePaths,
      "public",
    ]);
    const entries = rawTree
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const match = /^(\d+) (\w+) ([a-f0-9]{40})\t(.+)$/.exec(line);
        if (!match) throw new Error("Invalid Git tree entry");
        const [, mode, type, objectID, relative] = match;
        safeRelative(relative);
        if (type !== "blob" || !["100644", "100755"].includes(mode))
          throw new Error(
            "Allowed Git source must contain regular files only: " + relative,
          );
        return { relative, objectID };
      });
    const entryMap = new Map(entries.map((entry) => [entry.relative, entry]));
    for (const relative of [
      ...inputFiles,
      "src/migrations/index.ts",
      ...sourcePaths.slice(-2),
    ])
      if (!entryMap.has(relative))
        throw new Error("Missing required source at exact SHA: " + relative);
    if (entryMap.get(coreMigrationPath)?.objectID !== coreMigrationBlob)
      throw new Error("Reviewed core migration blob mismatch");
    const archivePaths = entries.some((entry) =>
      entry.relative.startsWith("public/"),
    )
      ? [...sourcePaths, "public"]
      : sourcePaths;
    const gitArchive = path.join(work, "source.tar");
    await command("git", [
      "-C",
      repo,
      "archive",
      "--format=tar",
      "--output=" + gitArchive,
      sourceSHA,
      "--",
      ...archivePaths,
    ]);
    await command("tar", ["-xf", gitArchive, "-C", stage]);
    for (const entry of entries) {
      const bytes = await fs.readFile(at(stage, entry.relative));
      if (gitBlob(bytes) !== entry.objectID)
        throw new Error(
          "Git export changed or omitted an allowed source blob: " +
            entry.relative,
        );
      await fs.chmod(at(stage, entry.relative), 0o644);
    }
    const inputsSHA256 = {};
    for (const relative of inputFiles) {
      const digest = sha256(await fs.readFile(at(stage, relative)));
      if (
        metadata.inputsSHA256[relative] !== digest ||
        sha256(await fs.readFile(at(build, relative))) !== digest
      )
        throw new Error(
          "Builder input is not from the exact Git SHA: " + relative,
        );
      inputsSHA256[relative] = digest;
    }
    const index = await fs.readFile(
      at(stage, "src/migrations/index.ts"),
      "utf8",
    );
    const migrationNames = [
      ...index.matchAll(/\bname:\s*(['"])([\w]+)\1/g),
    ].map((match) => match[2]);
    if (JSON.stringify(migrationNames) !== JSON.stringify(expectedMigrations))
      throw new Error("The reviewed ordered 17-migration index is required");
    const diskMigrations = entries
      .filter((entry) =>
        /^src\/migrations\/(?!index\.)([^/]+)\.(?:ts|js)$/.test(entry.relative),
      )
      .map((entry) =>
        path.basename(entry.relative).replace(/\.(?:ts|js)$/, ""),
      );
    if (
      JSON.stringify(sort(diskMigrations)) !==
      JSON.stringify(sort([...expectedMigrations]))
    )
      throw new Error("Migration source files and index differ");
    const snapshot = JSON.parse(
      await fs.readFile(at(stage, snapshotPath), "utf8"),
    );
    const tables = snapshot.tables;
    if (!tables || Object.keys(tables).length !== 69)
      throw new Error("Reviewed joint 69-table snapshot required");
    const honorFKs = Object.values(
      tables["public.team_honor_records"]?.foreignKeys || {},
    );
    for (const [column, tableTo] of [
      ["team_id", "teams"],
      ["game_id", "games"],
      ["season_id", "seasons"],
      ["author_id", "users"],
    ]) {
      if (
        !honorFKs.some(
          (fk) =>
            fk.tableTo === tableTo &&
            JSON.stringify(fk.columnsFrom) === JSON.stringify([column]) &&
            JSON.stringify(fk.columnsTo) === JSON.stringify(["id"]) &&
            fk.onDelete === "restrict" &&
            fk.onUpdate === "no action",
        )
      )
        throw new Error(
          "Honor ownership RESTRICT constraint mismatch: " + column,
        );
    }
    const nextRoot = path.join(build, ".next");
    const nextInfo = await fs.lstat(nextRoot);
    if (!nextInfo.isDirectory() || nextInfo.isSymbolicLink())
      throw new Error("Next output must be a real directory");
    const nextFiles = await tree(nextRoot, "", true);
    for (const required of [
      "BUILD_ID",
      "required-server-files.json",
      "routes-manifest.json",
      "prerender-manifest.json",
    ])
      if (!nextFiles.includes(required))
        throw new Error("Incomplete Next runtime output: " + required);
    if (
      !nextFiles.some((file) => file.startsWith("server/")) ||
      !nextFiles.some((file) => file.startsWith("static/"))
    )
      throw new Error("Next server and static runtime output are required");
    const requiredServerFiles = JSON.parse(
      await fs.readFile(
        path.join(nextRoot, "required-server-files.json"),
        "utf8",
      ),
    );
    if (requiredServerFiles.config?.output)
      throw new Error(
        "This recipe requires the reviewed Next start output, without export/standalone",
      );
    const originalNext = await fingerprint(nextRoot, nextFiles);
    for (const relative of nextFiles) {
      const destination = at(stage, ".next/" + relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(
        at(nextRoot, relative),
        destination,
        constants.COPYFILE_EXCL,
      );
      await fs.chmod(destination, 0o644);
    }
    if (
      JSON.stringify(nextFiles) !==
        JSON.stringify(await tree(nextRoot, "", true)) ||
      JSON.stringify(originalNext) !==
        JSON.stringify(await fingerprint(nextRoot, nextFiles)) ||
      sha256(metadataBytes) !==
        sha256(await fs.readFile(path.join(build, "CLUB_BUILD_METADATA.json")))
    )
      throw new Error("Build output or metadata changed during packaging");
    await fs.writeFile(path.join(stage, "SOURCE_REVISION"), sourceSHA + "\n", {
      mode: 0o644,
    });
    const files = await fingerprint(stage, await tree(stage));
    for (const relative of nextFiles)
      if (files[".next/" + relative].sha256 !== originalNext[relative].sha256)
        throw new Error("Copied Next runtime bytes differ: " + relative);
    const capabilityPaths = [
      "scripts/backup.mjs",
      "scripts/club-operations-rollback-check.ts",
      "src/lib/team-honor-videos.ts",
      "src/collections/team-core.ts",
      "src/lib/team-locks.ts",
      "src/lib/team-memberships.ts",
      "src/lib/team-profiles-authority.ts",
      "src/collections/index.ts",
    ];
    const includedCapabilityEvidence = {};
    for (const relative of capabilityPaths) {
      if (!files[relative])
        throw new Error(
          "Missing compatible-rollback capability source: " + relative,
        );
      includedCapabilityEvidence[relative] = files[relative].sha256;
    }
    const contract = {
      schemaVersion: 1,
      kind: "club-code-with-reused-dependencies",
      sourceSHA,
      buildID,
      builder: {
        node: builder.node,
        platform: builder.platform,
        arch: builder.arch,
        glibc: builder.glibc,
      },
      target,
      buildMetadataSHA256: sha256(metadataBytes),
      inputsSHA256,
      dependencies: {
        copied: false,
        bindPath: "/srv/zijingwebsite/app/node_modules",
        deploymentFingerprintVerificationRequired: true,
        preservePostgresBinaryDirectory: "/srv/zijingwebsite/app/node_modules",
        preservePostgresDataDirectory: "/srv/zijingwebsite/app/.data/postgres",
        absoluteDatabaseMediaEnvironmentBindingsRequired: true,
        pgBin: "/srv/zijingwebsite/tools/pg17/usr/lib/postgresql/17/bin",
      },
      migrations: {
        names: migrationNames,
        indexSHA256: files["src/migrations/index.ts"].sha256,
        coreMigrationPath,
        coreMigrationBlob,
        snapshotPath,
        snapshotSHA256: files[snapshotPath].sha256,
        snapshotTables: 69,
        honorOwnershipDeleteAction: "restrict",
        productionSchemaVerificationRequired: true,
      },
      compatibleRollback: {
        useSameValidatedCapabilityArtifact: true,
        appliesToSchemaMigrations: migrationNames,
        retainNewBusinessData: true,
        oldCF961BaselineAllowed: false,
        migrationDownAllowed: false,
        backupManifestVersion: 3,
        privateVideoDirectory: ".team-honor-videos",
        permanentMarkerDirectory: ".showcase-videos/.team-honor-reserved",
        includedCapabilityEvidence,
        runtimeAcceptanceRequired: true,
      },
      validation: {
        packagingOnly: true,
        applicationHTTPVerified: false,
        runnerVerified: false,
        productionVerified: false,
      },
      sizesRecordedInExternalManifest: true,
      files,
    };
    await fs.writeFile(
      path.join(stage, "release-contract.json"),
      stringify(contract),
      { mode: 0o644 },
    );
    const finalFiles = await fingerprint(stage, await tree(stage));
    const expandedBytes = Object.values(finalFiles).reduce(
      (sum, file) => sum + file.bytes,
      0,
    );
    if (expandedBytes > maximumExpandedBytes)
      throw new Error(
        "Expanded code package exceeds 100 MiB: " + expandedBytes + " bytes",
      );
    const list = path.join(work, "files.list");
    await fs.writeFile(
      list,
      Buffer.from(sort(Object.keys(finalFiles)).join("\0") + "\0"),
    );
    const tar = path.join(work, "code.tar");
    await command("tar", [
      "--format=posix",
      "--sort=name",
      "--mtime=@0",
      "--owner=0",
      "--group=0",
      "--numeric-owner",
      "--mode=0644",
      "--pax-option=exthdr.name=%d/PaxHeaders/%f,delete=atime,delete=ctime",
      "--no-recursion",
      "--null",
      "-C",
      stage,
      "-T",
      list,
      "-cf",
      tar,
    ]);
    const archive = path.join(work, "code.tar.gz");
    await compress(tar, archive);
    const compressedBytes = (await fs.stat(archive)).size;
    if (compressedBytes > maximumCompressedBytes)
      throw new Error(
        "Compressed code package exceeds 50 MiB: " + compressedBytes + " bytes",
      );
    const archiveHash = createHash("sha256");
    for await (const chunk of createReadStream(archive))
      archiveHash.update(chunk);
    const manifest = {
      ...contract,
      files: finalFiles,
      archive: {
        filename: path.basename(destinationArchive),
        sha256: archiveHash.digest("hex"),
        compressedBytes,
        expandedBytes,
        fileCount: Object.keys(finalFiles).length,
        maximumCompressedBytes,
        maximumExpandedBytes,
        expandedBytesMeaning:
          "sum of unpacked regular-file sizes; filesystem allocation and peak headroom require separate verification",
        format:
          "POSIX tar, sorted UTF-8 paths, mtime 0, uid/gid 0, mode 0644, deterministic PAX headers; gzip -n -9",
      },
    };
    await fs.copyFile(archive, destinationArchive, constants.COPYFILE_EXCL);
    createdOutputs.push(destinationArchive);
    await fs.writeFile(destinationManifest, stringify(manifest), {
      flag: "wx",
      mode: 0o600,
    });
    createdOutputs.push(destinationManifest);
    console.log(
      JSON.stringify({
        sourceSHA,
        buildID,
        archive: destinationArchive,
        manifest: destinationManifest,
        sha256: manifest.archive.sha256,
        compressedBytes,
        expandedBytes,
        packagingOnly: true,
      }),
    );
  } catch (error) {
    for (const created of createdOutputs)
      await fs.unlink(created).catch(() => {});
    throw error;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("Code package refused: " + error.message);
  process.exitCode = 1;
});
