import "dotenv/config";
import { test as base, expect } from "@playwright/test";
import { getPayload } from "payload";
import config from "../../src/payload.config";
import { randomBytes } from "node:crypto";

export const memberTest = base.extend<{ memberSession: void }, { memberCredentials: { email: string; password: string } }>({
  memberCredentials: [async ({ browserName }, use) => {
    void browserName;
    if (process.env.APP_ENV !== "development") throw new Error("Development only");
    const p = await getPayload({ config });
    const suffix = randomBytes(8).toString("hex");
    const credentials = { email: `layout-${suffix}@example.invalid`, password: randomBytes(24).toString("hex") };
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { ...credentials, name: `Layout-${suffix}`, roles: ["member"] } });
    try { await use(credentials); }
    finally { await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } }); await p.destroy(); }
  }, { scope: "worker" }],
  memberSession: [async ({ context, memberCredentials }, use) => {
    const response = await context.request.post("/api/users/login", { data: memberCredentials });
    expect(response.ok()).toBe(true);
    await use();
  }, { auto: true }],
});
