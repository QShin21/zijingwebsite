import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalReq, getPayload, type Payload } from "payload";
import { randomBytes } from "node:crypto";
import config from "../src/payload.config";
import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";
import { up as migrateNickname } from "../src/migrations/20260926_145257_nickname_login";

let p: Payload;
const suffix = Date.now();
const password = randomBytes(24).toString("hex");
const created: number[] = [];
const create = async (name: string, tag: string) => {
  const user = await p.create({
    collection: "users",
    overrideAccess: true,
    context: { system: true },
    data: {
      name,
      email: `nickname-${tag}-${suffix}@example.invalid`,
      password,
      roles: ["member"],
    },
  });
  created.push(user.id);
  return user;
};

beforeAll(async () => {
  if (process.env.APP_ENV !== "development")
    throw new Error("Development database required");
  p = await getPayload({ config });
});
afterAll(async () => {
  if (!p) return;
  for (const id of created)
    await p.delete({
      collection: "users",
      id,
      overrideAccess: true,
      context: { system: true },
    });
  await p.destroy();
});

describe.sequential("昵称唯一身份", () => {
  it("创建和修改均去除首尾空格并拒绝重名", async () => {
    const first = await create(` Shin-${suffix} `, "first");
    expect(first.name).toBe(`Shin-${suffix}`);
    expect(first).not.toHaveProperty("account");
    await expect(
      create(first.name.toUpperCase(), "duplicate"),
    ).rejects.toThrow();
    const second = await create(`其他-${suffix}`, "second");
    await expect(
      p.update({
        collection: "users",
        id: second.id,
        overrideAccess: true,
        context: { system: true },
        data: { name: ` ${first.name.toLowerCase()} ` },
      }),
    ).rejects.toThrow();
    expect(
      (await p.findByID({ collection: "users", id: second.id })).name,
    ).toBe(second.name);
    const result = await p.login({
      collection: "users",
      data: { email: first.email, password },
    });
    expect(result.user?.id).toBe(first.id);
  });
  it("并发创建相同昵称仅允许一个成功", async () => {
    const results = await Promise.allSettled([
      create(`Race-${suffix}`, "race1"),
      create(`RACE-${suffix}`, "race2"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("系统写入同样不能使用邮箱形态的昵称", async () => {
    await expect(create("player@example.com", "invalid")).rejects.toThrow();
  });
  it("伪造匹配键不能绕过重名约束，修改昵称同步匹配键", async () => {
    const user = await create(`Original-${suffix}`, "rename");
    const updated = await p.update({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      context: { system: true },
      data: { name: `Renamed-${suffix}`, nameKey: "forged-key" },
    });
    expect(updated.name).toBe(`Renamed-${suffix}`);
    const found = await p.find({
      collection: "users",
      overrideAccess: true,
      where: { nameKey: { equals: `renamed-${suffix}` } },
    });
    expect(found.docs.map((doc) => doc.id)).toEqual([user.id]);
    await expect(
      create(`RENAMED-${suffix}`, "rename-collision"),
    ).rejects.toThrow();
    await p.update({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      context: { system: true },
      data: { nameKey: "another-forged-key" },
    });
    expect(
      (
        await p.findByID({
          collection: "users",
          id: user.id,
          overrideAccess: true,
        })
      ).nameKey,
    ).toBe(`renamed-${suffix}`);
  });
  it("迁移保留旧昵称大小写及数字账户，新账户不必填写旧字段", async () => {
    await p.db.drizzle.transaction(async (tx) => {
      await tx.execute(sql`CREATE TEMP TABLE users (id integer PRIMARY KEY, name varchar, account varchar NOT NULL) ON COMMIT DROP;
        CREATE UNIQUE INDEX users_account_idx ON users(account);
        INSERT INTO users VALUES (1, 'Shin', '123456');`);
      await migrateNickname({
        db: tx,
        payload: p,
        req: await createLocalReq({}, p),
      } as MigrateUpArgs);
      const { rows } = await tx.execute(sql`SELECT * FROM users`);
      expect(rows).toEqual([
        { id: 1, name: "Shin", account: "123456", name_key: "shin" },
      ]);
      // The retained archive column must not prevent modern account creation.
      await tx.execute(sql`INSERT INTO users(id, name, name_key) VALUES (2, 'NewMember', 'newmember')`);
      expect((await tx.execute(sql`SELECT account FROM users WHERE id = 2`)).rows)
        .toEqual([{ account: null }]);
      // Keep historical account uniqueness without making it a login field.
      await expect(tx.transaction(async (nested) => {
        await nested.execute(sql`INSERT INTO users(id, name, name_key, account) VALUES (3, 'OtherMember', 'othermember', '123456')`);
      })).rejects.toThrow();
      expect((await tx.execute(sql`SELECT account FROM users WHERE id = 1`)).rows)
        .toEqual([{ account: "123456" }]);
    });
  });
  for (const [names, error] of [
    [["Shin", "SHIN"], "case-insensitive duplicate"],
    [["Shin", "bad@name"], "invalid existing"],
  ] as const) {
    it(`迁移遇到 ${error} 时保留旧数据`, async () => {
      await p.db.drizzle.transaction(async (tx) => {
        await tx.execute(sql`CREATE TEMP TABLE users (id integer PRIMARY KEY, name varchar, account varchar NOT NULL) ON COMMIT DROP;
          CREATE UNIQUE INDEX users_account_idx ON users(account);`);
        await tx.execute(
          sql`INSERT INTO users VALUES (1, ${names[0]}, '123456'), (2, ${names[1]}, '654321')`,
        );
        await expect(
          tx.transaction(async (nested) => {
            await migrateNickname({
              db: nested,
              payload: p,
              req: await createLocalReq({}, p),
            } as MigrateUpArgs);
          }),
        ).rejects.toThrow(error);
        const { rows } = await tx.execute(sql`SELECT * FROM users ORDER BY id`);
        expect(rows).toEqual([
          { id: 1, name: names[0], account: "123456" },
          { id: 2, name: names[1], account: "654321" },
        ]);
      });
    });
  }
});
