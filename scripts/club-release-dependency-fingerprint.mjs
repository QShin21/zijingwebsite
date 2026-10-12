#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fsSync, { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { createRequire, isBuiltin } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const target = { node: "24.12", platform: "linux", arch: "x64", glibc: "2.36" };
const sort = (values) =>
  values.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
const inside = (root, value) =>
  value === root || value.startsWith(root + path.sep);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const text = (value) => JSON.stringify(value, null, 2) + "\n";
const requiredEntries = [
  "rootTsxCLI",
  "payloadAPI",
  "payloadBin",
  "payloadTsxAPI",
  "nextAPI",
  "nextCLI",
  "nextSWCLoader",
  "swcNative",
  "sharpAPI",
  "sharpNativeLoader",
  "sharpNative",
  "libvipsBinary",
  "rootEsbuildAPI",
  "rootEsbuildBinary",
  "payloadEsbuildAPI",
  "payloadEsbuildBinary",
];
const requiredRootSubpaths = {
  "@payloadcms/next": [
    "auth",
    "css",
    "layouts",
    "routes",
    "rsc",
    "views",
    "withPayload",
  ],
};

function runtimeTuple() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    glibc: process.report.getReport().header.glibcVersionRuntime,
  };
}
function requireTarget(runtime) {
  if (
    !runtime ||
    !/^v24\.12\.\d+$/.test(runtime.node || "") ||
    runtime.platform !== target.platform ||
    runtime.arch !== target.arch ||
    runtime.glibc !== target.glibc
  )
    throw new Error(
      "Actual dependency probe runtime must be Linux x64/glibc 2.36/Node 24.12",
    );
}
function validRelative(relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.posix.isAbsolute(relative) ||
    relative.includes("\\") ||
    relative
      .split("/")
      .some((part) => !part || part === "." || part === "..") ||
    [...relative].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error("Invalid physical dependency path");
}
function physical(root, value) {
  const result = fsSync.realpathSync(value);
  if (!inside(root, result))
    throw new Error("Dependency resolves outside the bound node_modules");
  return result;
}
function relative(root, value) {
  const result = path
    .relative(root, physical(root, value))
    .split(path.sep)
    .join("/");
  validRelative(result);
  return result;
}
function contextPath(root, project, context) {
  if (context === null) return path.join(project, "package.json");
  validRelative(context);
  return physical(root, path.join(root, ...context.split("/")));
}
function resolvePackage(root, project, context, name) {
  const require = createRequire(contextPath(root, project, context));
  for (const base of require.resolve.paths(name) || []) {
    const file = path.join(base, name, "package.json");
    try {
      const actual = physical(root, file);
      const pkg = JSON.parse(fsSync.readFileSync(actual, "utf8"));
      if (pkg.name !== name || typeof pkg.version !== "string")
        throw new Error("Invalid dependency package identity: " + name);
      return path.dirname(actual);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
  }
  const error = new Error("Missing dependency package: " + name);
  error.code = "MODULE_NOT_FOUND";
  throw error;
}
function packageForFile(root, file) {
  let directory = path.dirname(physical(root, file));
  while (inside(root, directory) && directory !== root) {
    const manifest = path.join(directory, "package.json");
    if (fsSync.existsSync(manifest)) {
      const pkg = JSON.parse(fsSync.readFileSync(manifest, "utf8"));
      if (typeof pkg.name === "string" && typeof pkg.version === "string")
        return { directory, pkg };
    }
    directory = path.dirname(directory);
  }
  throw new Error("Resolved entry has no package identity");
}
function rootDependencySeeds(root, project) {
  const bytes = fsSync.readFileSync(path.join(project, "package.json"));
  const declarations = JSON.parse(bytes).dependencies;
  if (
    !declarations ||
    typeof declarations !== "object" ||
    Array.isArray(declarations) ||
    !Object.keys(declarations).length
  )
    throw new Error("Project root dependencies are required");
  const require = createRequire(path.join(project, "package.json"));
  const rootDependencies = {},
    packages = [],
    resolutions = [];
  for (const name of sort(Object.keys(declarations))) {
    const declaredVersion = declarations[name];
    if (
      isBuiltin(name) ||
      typeof declaredVersion !== "string" ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
        declaredVersion,
      )
    )
      throw new Error(
        "Root dependency must pin an exact package version: " + name,
      );
    const directory = resolvePackage(root, project, null, name);
    const pkg = JSON.parse(
      fsSync.readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    if (pkg.name !== name || pkg.version !== declaredVersion)
      throw new Error("Root dependency declaration/version mismatch: " + name);
    const packagePath = relative(root, directory);
    packages.push(directory);
    resolutions.push({
      context: null,
      specifier: name,
      kind: "package",
      path: packagePath,
      optional: false,
    });
    const entries = {};
    for (const specifier of [
      name,
      ...(requiredRootSubpaths[name] || []).map(
        (subpath) => name + "/" + subpath,
      ),
    ]) {
      let actual;
      try {
        actual = physical(root, require.resolve(specifier));
      } catch (error) {
        // Packages such as @payloadcms/next expose subpaths without a root API.
        if (
          specifier === name &&
          !["pg", "dotenv"].includes(name) &&
          error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" &&
          pkg.exports &&
          typeof pkg.exports === "object" &&
          !Object.hasOwn(pkg.exports, ".") &&
          Object.keys(pkg.exports).some((key) => key.startsWith("./"))
        )
          continue;
        throw error;
      }
      if (
        !fsSync.statSync(actual).isFile() ||
        packageForFile(root, actual).directory !== directory
      )
        throw new Error("Root dependency entry/package mismatch: " + specifier);
      entries[specifier] = relative(root, actual);
      resolutions.push({
        context: null,
        specifier,
        kind: "module",
        path: entries[specifier],
        optional: false,
      });
    }
    rootDependencies[name] = {
      declaredVersion,
      packageName: pkg.name,
      packageVersion: pkg.version,
      packagePath,
      entries,
    };
  }
  return {
    rootPackageSHA256: digest(bytes),
    rootDependencies,
    packages,
    resolutions,
  };
}
async function hashFile(file) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}
function platformMatches(pkg) {
  for (const [key, value] of [
    ["os", "linux"],
    ["cpu", "x64"],
    ["libc", "glibc"],
  ]) {
    const list = pkg[key];
    if (
      Array.isArray(list) &&
      (list.includes("!" + value) ||
        (list.some((item) => !item.startsWith("!")) && !list.includes(value)))
    )
      return false;
  }
  return true;
}

const ignoredOwnedDirectories = new Set([
  "node_modules",
  ".git",
  "test",
  "tests",
  "__tests__",
  "docs",
  ".github",
]);
async function ownedInventory(
  root,
  directory,
  files = new Map(),
  aliases = {},
) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (
      ignoredOwnedDirectories.has(entry.name) ||
      entry.name.startsWith(".env")
    )
      continue;
    const logical = path.join(directory, entry.name);
    const info = await fs.lstat(logical);
    const actual = physical(root, logical);
    if (info.isSymbolicLink()) {
      if (!(await fs.stat(actual)).isFile())
        throw new Error("Unsupported directory alias inside runtime package");
      aliases[path.relative(root, logical).split(path.sep).join("/")] =
        relative(root, actual);
    }
    if (info.isDirectory()) await ownedInventory(root, actual, files, aliases);
    else if (info.isFile() || info.isSymbolicLink())
      files.set(relative(root, actual), actual);
    else throw new Error("Special file in dependency package");
  }
  return { files, aliases };
}

// Recheck bytes and resolution under a new physical node_modules root; no probes or config imports.
export async function verifyDependencyMetadata(
  metadata,
  project,
  sourceSHA,
  builder,
) {
  if (
    metadata?.schemaVersion !== 1 ||
    metadata.kind !== "club-release-dependency-fingerprint" ||
    metadata.sourceSHA !== sourceSHA
  )
    throw new Error("Dependency metadata exact source SHA/schema mismatch");
  requireTarget(metadata.runtime);
  if (
    builder &&
    Object.keys(metadata.runtime).some(
      (key) => metadata.runtime[key] !== builder[key],
    )
  )
    throw new Error("Dependency probe and builder runtime tuples differ");
  const { fingerprintSHA256, ...body } = metadata;
  if (fingerprintSHA256 !== digest(text(body)))
    throw new Error("Dependency metadata self-digest mismatch");
  const root = await fs.realpath(path.join(project, "node_modules"));
  for (const label of requiredEntries) {
    const entry = metadata.entries?.[label];
    if (
      !entry ||
      !metadata.files?.[entry.path] ||
      !metadata.packages?.[entry.packagePath]
    )
      throw new Error("Missing mandatory actual dependency entry: " + label);
  }
  if (
    !Array.isArray(metadata.resolutions) ||
    !metadata.resolutions.length ||
    !metadata.files ||
    !Object.keys(metadata.files).length
  )
    throw new Error("Dependency closure/resolution evidence is empty");
  const seeds = rootDependencySeeds(root, project);
  if (
    metadata.rootPackageSHA256 !== seeds.rootPackageSHA256 ||
    JSON.stringify(metadata.rootDependencies) !==
      JSON.stringify(seeds.rootDependencies)
  )
    throw new Error(
      "Complete project root dependency seeds/declarations mismatch",
    );
  for (const [name, seed] of Object.entries(seeds.rootDependencies)) {
    const pkg = metadata.packages?.[seed.packagePath];
    if (
      pkg?.name !== name ||
      pkg.version !== seed.declaredVersion ||
      !metadata.files[seed.packagePath + "/package.json"] ||
      Object.values(seed.entries).some((entry) => !metadata.files[entry])
    )
      throw new Error("Root dependency seed is missing from closure: " + name);
  }
  for (const required of seeds.resolutions) {
    if (
      !metadata.resolutions.some(
        (record) =>
          record.context === required.context &&
          record.specifier === required.specifier &&
          record.kind === required.kind &&
          record.path === required.path &&
          record.optional === false,
      )
    )
      throw new Error(
        "Missing root dependency resolution: " + required.specifier,
      );
  }
  for (const resolution of metadata.resolutions) {
    const context = contextPath(root, project, resolution.context);
    let actual;
    try {
      actual =
        resolution.kind === "package"
          ? resolvePackage(
              root,
              project,
              resolution.context,
              resolution.specifier,
            )
          : createRequire(context).resolve(resolution.specifier);
    } catch (error) {
      if (
        resolution.optional &&
        resolution.path === null &&
        error.code === "MODULE_NOT_FOUND"
      )
        continue;
      throw error;
    }
    if (resolution.path === null || relative(root, actual) !== resolution.path)
      throw new Error(
        "Dependency resolution mismatch: " + resolution.specifier,
      );
  }
  for (const [alias, destination] of Object.entries(metadata.aliases || {})) {
    validRelative(alias);
    validRelative(destination);
    const aliasPath = path.join(root, ...alias.split("/"));
    if (
      !(await fs.lstat(aliasPath)).isSymbolicLink() ||
      relative(root, aliasPath) !== destination
    )
      throw new Error("Dependency physical alias mismatch: " + alias);
  }
  const inventory = new Map(),
    inventoryAliases = {};
  for (const [directory, entry] of Object.entries(metadata.packages || {})) {
    validRelative(directory);
    const file = path.join(root, ...directory.split("/"), "package.json");
    const pkg = JSON.parse(await fs.readFile(physical(root, file), "utf8"));
    if (pkg.name !== entry.name || pkg.version !== entry.version)
      throw new Error("Dependency package version mismatch: " + directory);
    await ownedInventory(root, path.dirname(file), inventory, inventoryAliases);
  }
  if (
    JSON.stringify(sort([...inventory.keys()])) !==
      JSON.stringify(sort(Object.keys(metadata.files))) ||
    JSON.stringify(Object.entries(inventoryAliases).sort()) !==
      JSON.stringify(Object.entries(metadata.aliases || {}).sort())
  )
    throw new Error("Runtime dependency closure inventory differs");
  for (const [file, expected] of Object.entries(metadata.files)) {
    validRelative(file);
    const actualFile = physical(root, path.join(root, ...file.split("/")));
    if (
      relative(root, actualFile) !== file ||
      !(await fs.lstat(actualFile)).isFile()
    )
      throw new Error(
        "Dependency file is not the recorded physical file: " + file,
      );
    const actual = await hashFile(actualFile);
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes)
      throw new Error("Dependency byte fingerprint mismatch: " + file);
  }
  for (const name of [
    "rootTsxCLI",
    "nextCLI",
    "swcNative",
    "sharpNative",
    "esbuild",
  ]) {
    if (metadata.probes?.[name]?.passed !== true)
      throw new Error("Actual dependency probe missing: " + name);
  }
  if (
    metadata.pendingRunner?.payloadBinConfigUp !== true ||
    metadata.pendingRunner?.actualRollbackCLI !== true
  )
    throw new Error(
      "Dependency metadata must preserve pending real Payload/rollback runner acceptance",
    );
  return metadata;
}

async function createMetadata(project, sourceSHA) {
  const runtime = runtimeTuple();
  requireTarget(runtime);
  for (const name of [
    "ESBUILD_BINARY_PATH",
    "NEXT_TEST_NATIVE_DIR",
    "NEXT_TEST_WASM",
    "__INTERNAL_CUSTOM_TURBOPACK_BINDINGS",
    "NODE_OPTIONS",
  ]) {
    if (process.env[name])
      throw new Error(
        "Dependency probes require default resolution without " + name,
      );
  }
  const root = await fs.realpath(path.join(project, "node_modules"));
  const entries = {},
    packageMap = new Map(),
    resolutions = new Map(),
    aliases = {};
  function recordResolution(
    context,
    specifier,
    kind,
    actual,
    optional = false,
  ) {
    const record = {
      context,
      specifier,
      kind,
      path: actual === null ? null : relative(root, actual),
      optional,
    };
    resolutions.set(JSON.stringify([context, specifier, kind]), record);
  }
  function addPackage(directory) {
    const actual = physical(root, directory);
    const manifest = path.join(actual, "package.json");
    const pkg = JSON.parse(fsSync.readFileSync(manifest, "utf8"));
    if (typeof pkg.name !== "string" || typeof pkg.version !== "string")
      throw new Error("Dependency package identity missing");
    if (!packageMap.has(actual))
      packageMap.set(actual, { directory: actual, pkg });
    return { directory: actual, pkg };
  }
  function addEntry(label, specifier, context = null) {
    const actual = physical(
      root,
      createRequire(contextPath(root, project, context)).resolve(specifier),
    );
    const owner = packageForFile(root, actual);
    addPackage(owner.directory);
    recordResolution(context, specifier, "module", actual);
    entries[label] = {
      path: relative(root, actual),
      packagePath: relative(root, owner.directory),
      packageName: owner.pkg.name,
      packageVersion: owner.pkg.version,
    };
    return actual;
  }
  const manifestContext = (entry) =>
    entries[entry].packagePath + "/package.json";
  const seeds = rootDependencySeeds(root, project);
  for (const directory of seeds.packages) addPackage(directory);
  for (const resolution of seeds.resolutions)
    recordResolution(
      resolution.context,
      resolution.specifier,
      resolution.kind,
      path.join(root, ...resolution.path.split("/")),
    );
  const tsxCLI = addEntry("rootTsxCLI", "tsx/cli");
  addEntry("payloadAPI", "payload");
  addEntry("payloadBin", "./bin.js", manifestContext("payloadAPI"));
  addEntry("payloadTsxAPI", "tsx/esm/api", manifestContext("payloadAPI"));
  addEntry("nextAPI", "next");
  const nextCLI = addEntry("nextCLI", "next/dist/bin/next");
  addEntry("nextSWCLoader", "next/dist/build/swc/index.js");
  const swcFile = addEntry(
    "swcNative",
    "@next/swc-linux-x64-gnu",
    manifestContext("nextAPI"),
  );
  if (entries.swcNative.packageVersion !== entries.nextAPI.packageVersion)
    throw new Error("SWC package version differs from Next");
  const sharpAPI = addEntry("sharpAPI", "sharp");
  addEntry(
    "sharpNativeLoader",
    "@img/sharp-linux-x64/sharp.node",
    manifestContext("sharpAPI"),
  );
  const libvipsFile = addEntry(
    "libvipsBinary",
    "@img/sharp-libvips-linux-x64/binary",
    manifestContext("sharpAPI"),
  );
  addEntry("rootEsbuildAPI", "esbuild", manifestContext("rootTsxCLI"));
  const rootEsbuildBin = addEntry(
    "rootEsbuildBinary",
    "@esbuild/linux-x64/bin/esbuild",
    manifestContext("rootEsbuildAPI"),
  );
  addEntry("payloadEsbuildAPI", "esbuild", manifestContext("payloadTsxAPI"));
  const payloadEsbuildBin = addEntry(
    "payloadEsbuildBinary",
    "@esbuild/linux-x64/bin/esbuild",
    manifestContext("payloadEsbuildAPI"),
  );

  // Include each selected package's owned files and declared runtime/installed peer closure.
  const processed = new Set();
  for (;;) {
    const pending = [...packageMap.values()].filter(
      (entry) => !processed.has(entry.directory),
    );
    if (!pending.length) break;
    for (const entry of pending) {
      processed.add(entry.directory);
      const context = relative(
        root,
        path.join(entry.directory, "package.json"),
      );
      const wanted = new Map();
      for (const name of Object.keys(entry.pkg.dependencies || {}))
        wanted.set(name, false);
      for (const name of Object.keys(entry.pkg.optionalDependencies || {}))
        wanted.set(name, true);
      for (const name of Object.keys(entry.pkg.peerDependencies || {}))
        if (!wanted.has(name))
          wanted.set(
            name,
            entry.pkg.peerDependenciesMeta?.[name]?.optional === true,
          );
      for (const [name, optional] of wanted) {
        if (isBuiltin(name)) continue;
        let directory;
        try {
          directory = resolvePackage(root, project, context, name);
        } catch (error) {
          if (optional && error.code === "MODULE_NOT_FOUND") {
            recordResolution(context, name, "package", null, true);
            continue;
          }
          throw error;
        }
        const pkg = JSON.parse(
          fsSync.readFileSync(path.join(directory, "package.json"), "utf8"),
        );
        if (optional && !platformMatches(pkg)) continue;
        recordResolution(context, name, "package", directory, optional);
        addPackage(directory);
      }
    }
  }
  const cleanEnv = {
    PATH: process.env.PATH,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
  };
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "club-dependency-probe-"),
  );
  const esbuildAPIs = [];
  let probes;
  try {
    async function version(file, expected) {
      const result = await exec(process.execPath, [file, "--version"], {
        cwd: temporary,
        env: cleanEnv,
        timeout: 20000,
        maxBuffer: 64 * 1024,
      });
      const stdout = result.stdout.trim();
      if (!stdout || !stdout.includes(expected))
        throw new Error("Version probe returned empty or wrong version");
      return { passed: true, stdout };
    }
    const rootTsxProbe = await version(
      tsxCLI,
      entries.rootTsxCLI.packageVersion,
    );
    const nextProbe = await version(nextCLI, entries.nextAPI.packageVersion);
    const require = createRequire(path.join(project, "package.json"));
    const swc = require(swcFile);
    const swcResult = swc.transformSync(
      "const clubProbe: number = 42;",
      false,
      Buffer.from(
        JSON.stringify({
          jsc: { parser: { syntax: "typescript" }, target: "es2022" },
          module: { type: "commonjs" },
        }),
      ),
    );
    const ast = JSON.parse(
      await swc.parse(
        "const clubProbe: number = 42;",
        Buffer.from(JSON.stringify({ syntax: "typescript" })),
      ),
    );
    if (
      !swcResult.code?.includes("clubProbe") ||
      !["Module", "Script"].includes(ast.type)
    )
      throw new Error("SWC native transform/parse failed");
    const sharp = require(sharpAPI);
    const png = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const image = await sharp(png).metadata();
    if (image.width !== 1 || image.height !== 1 || image.format !== "png")
      throw new Error("Sharp synthetic metadata probe failed");
    const nativeDirectory = path.join(
      root,
      ...entries.sharpNativeLoader.packagePath.split("/"),
    );
    const sharpNativeFiles = Object.keys(require.cache).filter(
      (file) =>
        file.endsWith(".node") &&
        inside(nativeDirectory, fsSync.realpathSync(file)),
    );
    if (sharpNativeFiles.length !== 1)
      throw new Error("Unable to identify actual loaded Sharp .node");
    const sharpNativeFile = physical(root, sharpNativeFiles[0]);
    const sharpOwner = packageForFile(root, sharpNativeFile);
    entries.sharpNative = {
      path: relative(root, sharpNativeFile),
      packagePath: relative(root, sharpOwner.directory),
      packageName: sharpOwner.pkg.name,
      packageVersion: sharpOwner.pkg.version,
    };
    const sharedObjects = process.report
      .getReport()
      .sharedObjects.map((file) => {
        try {
          return fsSync.realpathSync(file);
        } catch {
          return file;
        }
      });
    if (!sharedObjects.includes(libvipsFile))
      throw new Error(
        "Actual loaded libvips is not the selected physical binary",
      );
    const esbuildResults = [];
    for (const [apiLabel, bin] of [
      ["rootEsbuildAPI", rootEsbuildBin],
      ["payloadEsbuildAPI", payloadEsbuildBin],
    ]) {
      const api = require(
        path.join(root, ...entries[apiLabel].path.split("/")),
      );
      esbuildAPIs.push(api);
      const result = await exec(bin, ["--version"], {
        cwd: temporary,
        env: cleanEnv,
        timeout: 20000,
        maxBuffer: 64 * 1024,
      });
      if (
        result.stdout.trim() !== entries[apiLabel].packageVersion ||
        api.version !== entries[apiLabel].packageVersion
      )
        throw new Error("Esbuild actual executable/API version mismatch");
      const transformed = api.transformSync("const clubProbe: number = 42;", {
        loader: "ts",
        target: "es2022",
      });
      if (!transformed.code.includes("clubProbe"))
        throw new Error("Esbuild native transform failed");
      esbuildResults.push({
        api: apiLabel,
        version: api.version,
        executable: relative(root, bin),
        passed: true,
      });
    }
    probes = {
      rootTsxCLI: rootTsxProbe,
      nextCLI: nextProbe,
      swcNative: {
        passed: true,
        entry: relative(root, swcFile),
        transform: true,
        parse: true,
      },
      sharpNative: {
        passed: true,
        entry: relative(root, sharpNativeFile),
        libvips: relative(root, libvipsFile),
        width: 1,
        height: 1,
        format: "png",
        vipsVersion: sharp.versions.vips,
      },
      esbuild: { passed: true, results: esbuildResults },
    };
  } finally {
    for (const api of new Set(esbuildAPIs)) api.stop();
    await fs.rm(temporary, { recursive: true, force: true });
  }

  const files = {},
    packages = {};
  for (const entry of [...packageMap.values()].sort((a, b) =>
    Buffer.compare(
      Buffer.from(relative(root, a.directory)),
      Buffer.from(relative(root, b.directory)),
    ),
  )) {
    const key = relative(root, entry.directory);
    packages[key] = {
      name: entry.pkg.name,
      version: entry.pkg.version,
      manifestPath: key + "/package.json",
    };
    const inventory = await ownedInventory(
      root,
      entry.directory,
      new Map(),
      aliases,
    );
    for (const [file, actual] of inventory.files)
      files[file] = {
        ...(await hashFile(actual)),
        packageName: entry.pkg.name,
        packageVersion: entry.pkg.version,
      };
  }
  const sortedObject = (value) =>
    Object.fromEntries(
      sort(Object.keys(value)).map((key) => [key, value[key]]),
    );
  const metadata = {
    schemaVersion: 1,
    kind: "club-release-dependency-fingerprint",
    sourceSHA,
    rootPackageSHA256: seeds.rootPackageSHA256,
    rootDependencies: seeds.rootDependencies,
    runtime,
    target,
    physicalPathsRelativeTo:
      "bound node_modules realpath; no host absolute prefixes",
    entries: sortedObject(entries),
    packages: sortedObject(packages),
    resolutions: [...resolutions.values()].sort((a, b) =>
      Buffer.compare(
        Buffer.from(JSON.stringify(a)),
        Buffer.from(JSON.stringify(b)),
      ),
    ),
    aliases: sortedObject(aliases),
    files: sortedObject(files),
    probes,
    pendingRunner: {
      payloadBinConfigUp: true,
      actualRollbackCLI: true,
      applicationHTTP: true,
      productionSchema: true,
    },
  };
  metadata.fingerprintSHA256 = digest(text(metadata));
  await verifyDependencyMetadata(metadata, project, sourceSHA, runtime);
  return metadata;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(
      "Usage: node club-release-dependency-fingerprint.mjs --source <40-sha> --output <metadata.json> [--root <code-directory>]",
    );
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      !["--source", "--output", "--root"].includes(args[index]) ||
      !args[index + 1] ||
      options[args[index]]
    )
      throw new Error(
        "Expected --source <40-sha> --output <metadata.json> [--root <code-directory>]",
      );
    options[args[index]] = args[index + 1];
  }
  if (!/^[a-f0-9]{40}$/.test(options["--source"] || "") || !options["--output"])
    throw new Error("Exact source SHA and output file required");
  const project = await fs.realpath(
    path.resolve(options["--root"] || process.cwd()),
  );
  const output = path.resolve(options["--output"]);
  const metadata = await createMetadata(project, options["--source"]);
  await fs.writeFile(output, text(metadata), { flag: "wx", mode: 0o600 });
  console.log(
    JSON.stringify({
      sourceSHA: metadata.sourceSHA,
      output,
      fingerprintSHA256: metadata.fingerprintSHA256,
      packages: Object.keys(metadata.packages).length,
      files: Object.keys(metadata.files).length,
      runtime: metadata.runtime,
      pendingRunner: metadata.pendingRunner,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error("Dependency fingerprint refused: " + error.message);
    process.exitCode = 1;
  });
