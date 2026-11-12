import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { createUpload } from "../src/lib/v2/writes";
import { getImage, publicationAssetData } from "../src/lib/v2/images";
import { getEventDetail } from "../src/lib/v2/events";
import { changePromotion, readPromotionSource } from "../src/lib/content-promotions";

const stamp = randomBytes(5).toString("hex");
let p: Payload, owner: User, other: User, game: number, png: Buffer, uploadID: number, promotionID: number;
beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || !["localhost", "127.0.0.1"].includes(db.hostname) || !db.pathname.includes("synthetic"))
    throw new Error("Use an isolated synthetic database");
  p = await getPayload({ config, key: "publication-assets-synthetic" });
  const makeUser = (name: string, role: "president" | "vicePresident") => p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `${name}-${stamp}`, email: `${name}-${stamp}@example.invalid`, password: randomBytes(24).toString("hex"), roles: [role] } });
  owner = await makeUser("image-owner", "president"); other = await makeUser("image-other", "vicePresident");
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true },
    data: { title: "合成社群", slug: `asset-${stamp}`, _status: "published" } })).id;
  png = await sharp({ create: { width: 40, height: 40, channels: 3, background: "purple" } }).png().toBuffer();
});
afterAll(async () => {
  if (!p) return;
  try {
    if (promotionID) await p.delete({ collection: "content-promotions", id: promotionID, overrideAccess: true });
    if (game) {
      await p.delete({ collection: "community-posts", overrideAccess: true, where: { game: { equals: game } } });
      await p.delete({ collection: "games", id: game, overrideAccess: true });
    }
    for (const user of [owner, other]) if (user) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
  } finally { await p.destroy(); }
});

describe("活动配图独立上传与访问权限", () => {
  it("仅上传者可绑定，发布后只能通过有权访问的活动读取", async () => {
    const result = await createUpload(p, owner, { purpose: "publication", file: new File([new Uint8Array(png)], "synthetic.png", { type: "image/png" }) });
    uploadID = result.upload.id;
    const version = new URL(result.upload.preview.src, "http://localhost").searchParams.get("v");
    const source = `asset:${uploadID}:${version}`;
    const data = { title: "合成上传活动", body: "正文", game, category: "event" as const, author: owner.id, postImages: [{ source, alt: "合成图" }] };
    await expect(p.create({ collection: "community-posts", user: other, overrideAccess: false, data: { ...data, author: other.id } })).rejects.toThrow();
    const unclaimed = await p.findByID({ collection: "pending-uploads", id: uploadID, user: owner, overrideAccess: false });
    expect(unclaimed.consumedAt).toBeFalsy();
    const post = await p.create({ collection: "community-posts", user: owner, overrideAccess: false, data });
    const claimed = await p.findByID({ collection: "pending-uploads", id: uploadID, user: owner, overrideAccess: false });
    expect(claimed.consumedAt).toBeTruthy();
    await expect(p.create({ collection: "community-posts", user: owner, overrideAccess: false, data })).rejects.toThrow();
    const detail = await getEventDetail(p, owner, { source: "community", id: post.id });
    const image = detail.images[0];
    const args = { kind: "community-post", id: post.id, index: 0, version };
    expect(image.src).toContain(`/community-post/${post.id}/0`);
    expect((await getImage(p, owner, args)).status).toBe(200);
    await expect(getImage(p, null, args)).rejects.toMatchObject({ status: 404 });
    expect(await publicationAssetData(p, source)).toMatch(/^data:image\/webp;base64,/);
    const before = await readPromotionSource(p, "community-posts", post.id);
    promotionID = (await changePromotion(p, owner, "community-posts", post.id, "promote", { sourceVersion: before.version, reason: "合成升推" })).id;
    await p.update({ collection: "community-posts", id: post.id, user: owner, overrideAccess: false, data: { body: "已修改的合成正文" } });
    expect((await getImage(p, null, args)).status).toBe(200);
  });
});
