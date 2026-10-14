import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import { expect, it } from "vitest";
import { getBrowserSuitePayload } from "./e2e/payload-fixture";

it("keeps the site database usable after rebuild-activity destroys its Payload", async () => {
  const database = new URL(
    process.env.DATABASE_URL || "postgresql://unconfigured",
  );
  if (
    process.env.APP_ENV !== "development" ||
    process.env.DB_PUSH !== "false" ||
    !["127.0.0.1", "localhost"].includes(database.hostname)
  ) {
    throw new Error(
      "Synthetic loopback database with schema push disabled only",
    );
  }

  const { default: config } = await import("../src/payload.config");
  const resolved = await config;
  resolved.typescript.autoGenerate = false;
  resolved.admin.importMap.autoGenerate = false;
  const instances = new Set<Payload>();
  const destroyed = new Set<Payload>();
  const suffix = randomBytes(8).toString("hex");
  const email = `payload-lifecycle-${suffix}@example.invalid`;
  let background: Payload | undefined;
  let createdID: number | undefined;

  try {
    // Other specs can still use the worker's default instance.
    background = await getPayload({ config });
    instances.add(background);
    const activity = await getBrowserSuitePayload("rebuild-activity", resolved);
    instances.add(activity);
    const before = await activity.count({
      collection: "users",
      overrideAccess: true,
      where: { email: { equals: email } },
    });
    await activity.destroy();
    destroyed.add(activity);

    // Use the same config promise and the actual next suite's factory. A
    // destroyed shared cache entry fails this Local API query before assertions.
    const site = await getBrowserSuitePayload("site", config);
    instances.add(site);
    expect(
      await site.count({
        collection: "users",
        overrideAccess: true,
        where: { email: { equals: email } },
      }),
    ).toEqual(before);
    expect(new Set([background, activity, site]).size).toBe(3);
    expect(new Set([background.db, activity.db, site.db]).size).toBe(3);
    expect(
      new Set([background.db.pool, activity.db.pool, site.db.pool]).size,
    ).toBe(3);

    const user = await site.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        email,
        name: `合成生命周期-${suffix}`,
        password: randomBytes(24).toString("hex"),
        roles: ["member"],
      },
    });
    createdID = user.id;
    expect(
      await background.findByID({
        collection: "users",
        id: user.id,
        overrideAccess: true,
      }),
    ).toMatchObject({ id: user.id, email: user.email });

    await site.destroy();
    destroyed.add(site);
    expect(
      await background.findByID({
        collection: "users",
        id: user.id,
        overrideAccess: true,
      }),
    ).toMatchObject({ id: user.id, email: user.email });
  } finally {
    try {
      if (background && createdID) {
        await background.delete({
          collection: "users",
          id: createdID,
          overrideAccess: true,
          context: { system: true },
        });
        await background.delete({
          collection: "audit",
          where: { object: { equals: `users:${createdID}` } },
          overrideAccess: true,
        });
      }
    } finally {
      for (const instance of instances) {
        if (!destroyed.has(instance)) await instance.destroy();
      }
    }
  }
});
