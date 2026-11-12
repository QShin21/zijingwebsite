import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import { randomBytes } from "node:crypto";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";

let p: Payload,
  president: User,
  vice: User,
  member: User,
  staff: User,
  suspended: User;
const suffix = randomBytes(5).toString("hex");
const originalPassword = randomBytes(18).toString("hex");
async function create(
  label: string,
  roles: User["roles"],
  accountStatus: User["accountStatus"] = "active",
) {
  return p.create({
    collection: "users",
    overrideAccess: true,
    context: { system: true },
    data: {
      name: label + suffix,
      email: label + suffix + "@example.invalid",
      password: originalPassword,
      roles,
      accountStatus,
    },
  });
}
beforeAll(async () => {
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Local synthetic database required");
  p = await getPayload({ config });
  president = await create("pwd-president", ["president"]);
  vice = await create("pwd-vice", ["vicePresident"]);
  member = await create("pwd-member", ["member"]);
  staff = await create("pwd-staff", ["communityAdmin"]);
  suspended = await create("pwd-suspended", ["vicePresident"], "suspended");
});
afterAll(async () => {
  if (p) await p.destroy();
});

describe("administrative password reset", () => {
  for (const role of ["president", "vice"] as const) {
    it(
      role +
        " resets a user's password without verification and invalidates existing sessions",
      async () => {
        const target = await create("pwd-target-" + role, ["member"]);
        const oldLogin = await p.login({
          collection: "users",
          data: { email: target.email, password: originalPassword },
        });
        const password = randomBytes(20).toString("hex"),
          actor = role === "president" ? president : vice;
        await p.update({
          collection: "users",
          id: target.id,
          user: actor,
          overrideAccess: false,
          data: { password },
        });
        await expect(
          p.login({
            collection: "users",
            data: { email: target.email, password: originalPassword },
          }),
        ).rejects.toThrow();
        expect(
          (
            await p.login({
              collection: "users",
              data: { email: target.email, password },
            })
          ).user?.id,
        ).toBe(target.id);
        const oldSession = await p.auth({
          headers: new Headers({ Authorization: "JWT " + oldLogin.token }),
        });
        expect(oldSession.user).toBeNull();
        const audit = await p.find({
          collection: "audit",
          overrideAccess: false,
          user: president,
          where: {
            and: [
              { object: { equals: "users:" + target.id } },
              { action: { equals: "admin-password-reset" } },
            ],
          },
        });
        expect(audit.docs).toHaveLength(1);
        expect(audit.docs[0].actor).toBe(String(actor.id));
        expect(JSON.stringify(audit.docs)).not.toContain(password);
        expect(
          (
            await p.findByID({
              collection: "users",
              id: target.id,
              overrideAccess: true,
            })
          ).roles,
        ).toEqual(["member"]);
      },
    );
  }
  it("keeps ordinary self-service verification and cross-user restrictions", async () => {
    for (const actor of [member, staff, suspended]) {
      await expect(
        p.update({
          collection: "users",
          id: member.id,
          user: actor,
          overrideAccess: false,
          data: { password: randomBytes(20).toString("hex") },
        }),
      ).rejects.toThrow();
    }
    const password = randomBytes(20).toString("hex");
    await p.update({
      collection: "users",
      id: member.id,
      user: member,
      overrideAccess: false,
      context: { verifiedPasswordChange: true },
      data: { password },
    });
    expect(
      (
        await p.login({
          collection: "users",
          data: { email: member.email, password },
        })
      ).user?.id,
    ).toBe(member.id);
  });
  it("rejects short passwords and preserves the vice president's role/email restrictions", async () => {
    await expect(
      p.update({
        collection: "users",
        id: member.id,
        user: vice,
        overrideAccess: false,
        data: { password: "short" },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      p.update({
        collection: "users",
        id: member.id,
        user: vice,
        overrideAccess: false,
        data: {
          roles: ["president"],
          password: randomBytes(20).toString("hex"),
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      p.update({
        collection: "users",
        id: member.id,
        user: vice,
        overrideAccess: false,
        data: { email: "changed-" + suffix + "@example.invalid" },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("accepts unchanged CMS permissions and rejects nested permission changes", async () => {
    const game = await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "改密合成社群" + suffix,
        slug: "password-reset-" + suffix,
        demo: true,
      },
    });
    let target = await create("pwd-office", ["member"]);
    target = await p.update({
      collection: "users",
      id: target.id,
      overrideAccess: true,
      context: { system: true },
      data: {
        communityOffices: [
          { game: game.id, status: "active", grantedBy: president.id },
        ],
      },
    });
    const password = randomBytes(20).toString("hex");
    const fields = {
      roles: target.roles,
      department: null,
      accountStatus: target.accountStatus,
      communities: target.communities,
      communityOffices: target.communityOffices,
      teams: target.teams,
    };
    const updated = await p.update({
      collection: "users",
      id: target.id,
      user: vice,
      overrideAccess: false,
      data: { ...fields, password },
    });
    expect(updated.communityOffices).toEqual(target.communityOffices);
    expect(
      (
        await p.login({
          collection: "users",
          data: { email: target.email, password },
        })
      ).user?.id,
    ).toBe(target.id);
    await expect(
      p.update({
        collection: "users",
        id: target.id,
        user: vice,
        overrideAccess: false,
        data: {
          password: randomBytes(20).toString("hex"),
          communityOffices: target.communityOffices!.map((office) => ({
            ...office,
            exportSignups: true,
          })),
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      p.update({
        collection: "users",
        id: target.id,
        user: vice,
        overrideAccess: false,
        data: {
          password: randomBytes(20).toString("hex"),
          accountStatus: "suspended",
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
