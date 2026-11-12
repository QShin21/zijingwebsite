import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { decideCommunityApplication } from "../src/lib/community-operations";
import { canPublish, canSubmitClubContent, communityIDs } from "../src/lib/rules";

let p: Payload, leader: User, vice: User, ordinary: User, honorary: User, backbone: User;
let game: number, another: number, qr: string;
const suffix = randomBytes(6).toString("hex"), actors: number[] = [], applications: number[] = [];

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || !["localhost", "127.0.0.1"].includes(db.hostname) || !db.pathname.includes("synthetic")) throw new Error("Use an isolated synthetic database");
  p = await getPayload({ config, key: "role-lifecycle-synthetic" });
  const user = async (name: string, roles: User["roles"]) => {
    const doc = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: {
      name: `${name}-${suffix}`, email: `${name}-${suffix}@example.invalid`, password: randomBytes(24).toString("hex"), roles,
    } }); actors.push(doc.id); return doc;
  };
  leader = await user("role-leader", ["president"]); vice = await user("role-vice", ["vicePresident"]);
  ordinary = await user("role-member", ["member"]); honorary = await user("role-honorary", ["honoraryBackbone"]);
  backbone = await user("role-backbone", ["backbone"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成任职社群", slug: `role-one-${suffix}`, _status: "published" } })).id;
  another = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成第二社群", slug: `role-two-${suffix}`, _status: "published" } })).id;
  qr = "data:image/png;base64," + (await sharp({ create: { width: 40, height: 40, channels: 3, background: "purple" } }).png().toBuffer()).toString("base64");
});

afterAll(async () => {
  if (!p) return;
  try {
    for (const id of applications) await p.delete({ collection: "community-applications", id, overrideAccess: true }).catch(() => null);
    for (const id of actors) await p.delete({ collection: "users", id, overrideAccess: true, context: { system: true } }).catch(() => null);
    for (const id of [game, another]) if (id) await p.delete({ collection: "games", id, overrideAccess: true }).catch(() => null);
  } finally { await p.destroy(); }
});

async function approve(actor: User, community: number) {
  const application = await p.create({ collection: "community-applications", user: actor, overrideAccess: false, data: {
    applicant: actor.id, game: community, proposedGame: "合成社群", realName: "合成申请人", phone: "00000000000",
    reason: "合成社群运营计划与申请说明", wechatQr: qr, contactConsent: true,
  } });
  applications.push(application.id);
  await decideCommunityApplication(p, vice, application.id, "approved", "", application.updatedAt);
  return p.findByID({ collection: "users", id: actor.id, overrideAccess: true, depth: 0 });
}

it("社长唯一，副社长不受数量限制", async () => {
  await expect(p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: {
    name: `second-president-${suffix}`, email: `second-president-${suffix}@example.invalid`, password: randomBytes(24).toString("hex"), roles: ["president"],
  } })).rejects.toThrow();
  const second = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: {
    name: `second-vice-${suffix}`, email: `second-vice-${suffix}@example.invalid`, password: randomBytes(24).toString("hex"), roles: ["vicePresident"],
  } }); actors.push(second.id); expect(canPublish(second)).toBe(true);
});

it("审批普通成员和荣誉骨干自动授予该社群权限，骨干保留较高身份", async () => {
  ordinary = await approve(ordinary, game);
  expect(ordinary.roles).toEqual(["communityAdmin"]);
  expect(ordinary.communityOffices?.[0]).toMatchObject({ status: "active", publishContent: true, reviewShowcase: true,
    handleJoins: true, viewSignups: true, exportSignups: true, contactConsent: true });
  honorary = await approve(honorary, game); expect(honorary.roles).toEqual(["communityAdmin"]);
  backbone = await approve(backbone, game); expect(backbone.roles).toEqual(["backbone"]);
  expect(communityIDs(backbone, "exportSignups")).toContain(String(game));
  // A deliberate later restriction remains in effect across unrelated updates.
  ordinary = await p.update({ collection: "users", id: ordinary.id, user: leader, overrideAccess: false,
    data: { communityOffices: ordinary.communityOffices!.map(office => ({ ...office, viewSignups: false, exportSignups: false })) } });
  await p.update({ collection: "users", id: ordinary.id, user: leader, overrideAccess: false, data: { name: ordinary.name } });
  expect(communityIDs(await p.findByID({ collection: "users", id: ordinary.id, overrideAccess: true }), "viewSignups")).toEqual([]);
  // Another approved community grant preserves the existing restricted office.
  ordinary = await approve(ordinary, another);
  expect(ordinary.communityOffices?.find(office => Number(office.game) === game)?.viewSignups).toBe(false);
  expect(ordinary.communityOffices?.find(office => Number(office.game) === another)?.viewSignups).toBe(true);
});

it("副社长可办理退休，撤销任职且无普通成员之外的平台权限", async () => {
  await expect(p.update({ collection: "users", id: ordinary.id, user: ordinary, overrideAccess: false, data: { roles: ["honoraryBackbone"] } })).rejects.toThrow();
  await expect(p.update({ collection: "users", id: ordinary.id, user: vice, overrideAccess: false, data: { roles: ["backbone"] } })).rejects.toThrow();
  await expect(p.update({ collection: "users", id: leader.id, user: vice, overrideAccess: false, data: { roles: ["honoraryBackbone"] } })).rejects.toThrow();
  const retired = await p.update({ collection: "users", id: ordinary.id, user: vice, overrideAccess: false, data: { roles: ["honoraryBackbone"] } });
  expect(retired.roles).toEqual(["honoraryBackbone"]); expect(retired.communityOffices?.every(office => office.status === "revoked")).toBe(true);
  expect(communityIDs(retired)).toEqual([]); expect(canPublish(retired)).toBe(false); expect(canSubmitClubContent(retired)).toBe(false);
  expect(retired.department).toBeNull(); expect(retired.teams ?? []).toEqual([]);
});
