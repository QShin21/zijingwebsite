import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loader = vi.hoisted(() => ({
  payloadLoads: 0,
  configLoads: 0,
  getPayload: vi.fn(),
}));
vi.mock("payload", () => {
  loader.payloadLoads++;
  return { getPayload: loader.getPayload };
});
vi.mock("../src/payload.config", () => {
  loader.configLoads++;
  return { default: { syntheticPreflight: true } };
});
import { checkProductionPreflight } from "../scripts/preflight";

const validEnvironment = {
  APP_ENV: "production",
  DB_PUSH: "false",
  NEXT_PUBLIC_SERVER_URL: "https://home.thuzijing.top",
  PAYLOAD_SECRET: "preflight-only-synthetic-secret-with-no-production-access",
  BACKUP_REMOTE: "/tmp/zijing-preflight-synthetic-peer",
  SMTP_HOST: "127.0.0.1",
};
beforeEach(() => {
  for (const [name, value] of Object.entries(validEnvironment))
    vi.stubEnv(name, value);
  loader.getPayload.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("preflight refuses environment before Payload or adapter initialization", () => {
  it.each([
    ["development", "true"],
    ["production", "true"],
    ["development", "false"],
    ["staging", "false"],
    ["production", undefined],
    ["production", ""],
    ["production", "FALSE"],
  ])("APP_ENV=%s DB_PUSH=%s cannot initialize", async (appEnv, push) => {
    vi.stubEnv("APP_ENV", appEnv);
    vi.stubEnv("DB_PUSH", push);
    const errors = await checkProductionPreflight();
    expect(errors.join("\n")).toMatch(/APP_ENV|DB_PUSH/);
    expect(loader.getPayload).not.toHaveBeenCalled();
    expect(loader.payloadLoads).toBe(0);
    expect(loader.configLoads).toBe(0);
  });
  it.each([
    ["NEXT_PUBLIC_SERVER_URL", "http://localhost:3000"],
    ["PAYLOAD_SECRET", ""],
    ["BACKUP_REMOTE", ""],
    ["SMTP_HOST", ""],
  ])("missing %s also stops before initialization", async (name, value) => {
    vi.stubEnv(name, value);
    expect((await checkProductionPreflight()).length).toBeGreaterThan(0);
    expect(loader.getPayload).not.toHaveBeenCalled();
    expect(loader.payloadLoads).toBe(0);
    expect(loader.configLoads).toBe(0);
  });
});

function reader() {
  const count = vi.fn(
    async (options: {
      collection: string;
      where: { demo?: unknown; roles?: unknown };
    }) => ({ totalDocs: options.where.demo ? 0 : 1 }),
  );
  const payload = {
    count,
    destroy: vi.fn(async () => {}),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  loader.getPayload.mockResolvedValue(payload);
  return payload;
}
it("explicit production/false keeps the existing count-only checks", async () => {
  const payload = reader();
  expect(await checkProductionPreflight()).toEqual([]);
  expect(loader.getPayload).toHaveBeenCalledTimes(1);
  expect(payload.count).toHaveBeenCalledTimes(12);
  expect(
    payload.count.mock.calls.slice(0, 10).map(([o]) => o.collection),
  ).toEqual([
    "games",
    "teams",
    "seasons",
    "honors",
    "events",
    "news",
    "recruitment",
    "albums",
    "pages",
    "media",
  ]);
  for (const [options] of payload.count.mock.calls.slice(0, 10))
    expect(options).toMatchObject({
      overrideAccess: true,
      where: { demo: { equals: true } },
    });
  expect(payload.count.mock.calls[10][0]).toEqual({
    collection: "users",
    overrideAccess: true,
    where: { roles: { contains: "president" } },
  });
  expect(payload.count.mock.calls[11][0]).toEqual({
    collection: "pages",
    overrideAccess: true,
    where: {
      and: [
        { key: { equals: "privacy" } },
        { _status: { equals: "published" } },
      ],
    },
  });
  expect(payload.destroy).toHaveBeenCalledTimes(1);
  for (const mutation of [payload.create, payload.update, payload.delete])
    expect(mutation).not.toHaveBeenCalled();
});
it("valid environment still reports demo rows, missing administrator and unpublished privacy", async () => {
  const payload = reader();
  payload.count.mockResolvedValue({ totalDocs: 0 });
  payload.count.mockResolvedValueOnce({ totalDocs: 2 });
  expect(await checkProductionPreflight()).toEqual([
    "games 仍有 2 条演示资料",
    "尚未建立系统管理员",
    "隐私说明尚未确认发布",
  ]);
  expect(payload.count).toHaveBeenCalledTimes(12);
  expect(payload.destroy).toHaveBeenCalledTimes(1);
});
it("count failures still close the initialized reader and fail", async () => {
  const payload = reader();
  payload.count.mockRejectedValueOnce(new Error("synthetic read failure"));
  await expect(checkProductionPreflight()).rejects.toThrow(
    "synthetic read failure",
  );
  expect(payload.destroy).toHaveBeenCalledTimes(1);
});

describe("actual CLI never connects for unsafe environment", () => {
  it.each([
    ["development", "true"],
    ["production", "true"],
    ["production", undefined],
  ])(
    "actual APP_ENV=%s DB_PUSH=%s exits with zero database sockets",
    async (appEnv, push) => {
      let connections = 0;
      const server = createServer((socket) => {
        connections++;
        socket.destroy();
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Synthetic TCP trap missing");
      const environment: NodeJS.ProcessEnv = {
        ...process.env,
        ...validEnvironment,
        APP_ENV: appEnv,
        DATABASE_URL: `postgresql://synthetic:synthetic@127.0.0.1:${address.port}/preflight_tcp_trap`,
        SMTP_PORT: "2526",
        S3_BUCKET: "",
      };
      if (push === undefined) delete environment.DB_PUSH;
      else environment.DB_PUSH = push;
      try {
        const result = await new Promise<{
          code: number | null;
          stdout: string;
          stderr: string;
        }>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              path.resolve("node_modules/tsx/dist/cli.mjs"),
              process.env.PREFLIGHT_REGRESSION_SCRIPT ||
                path.resolve("scripts/preflight.ts"),
            ],
            { env: environment, stdio: ["ignore", "pipe", "pipe"] },
          );
          let stdout = "",
            stderr = "";
          const timer = setTimeout(() => {
            child.kill();
            reject(new Error("Synthetic preflight CLI timeout"));
          }, 12000);
          child.stdout.on("data", (bytes) => {
            stdout += String(bytes);
          });
          child.stderr.on("data", (bytes) => {
            stderr += String(bytes);
          });
          child.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.once("close", (code) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr });
          });
        });
        expect(connections).toBe(0);
        expect(result.code).toBe(1);
        expect(result.stdout).toMatch(/待办：.*APP_ENV|待办：.*DB_PUSH/);
        expect(result.stderr).not.toMatch(
          /Connection|connect|Migrat|push|schema/i,
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );
});
