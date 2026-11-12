import "dotenv/config";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { getPayload, type Payload } from "payload";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import {
  getCommunityIconEditor,
  saveCommunityIcon,
  readCommunityIcon,
  prepareCommunityIcon,
} from "../src/lib/community-icons";
import { getCommunities, getCommunityHeader } from "../src/lib/v2/community";
import {
  defaultIconCrop,
  iconCropRect,
} from "../src/lib/community-icon-shared";
import { defaultGameIcon } from "../src/lib/default-game-icons";

let p: Payload,
  admin: User,
  member: User,
  other: User,
  vice: User,
  leader: User,
  stale: User;
let game: number,
  hiddenGame: number,
  source: string,
  revision = "",
  preservedSource = "";
const stamp = randomBytes(5).toString("hex"),
  slug = "icon-test-" + stamp,
  system = { system: true };
async function createUser(
  label: string,
  roles: User["roles"],
  offices: NonNullable<User["communityOffices"]> = [],
) {
  return p.create({
    collection: "users",
    overrideAccess: true,
    context: system,
    data: {
      name: label + stamp,
      email: label + stamp + "@example.invalid",
      password: randomBytes(24).toString("hex"),
      roles,
      communityOffices: offices,
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
    throw new Error("Use a local synthetic database");
  p = await getPayload({ config });
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: system,
      data: {
        title: "图标合成社群" + stamp,
        slug,
        summary: "已发布介绍",
        _status: "published",
        demo: true,
      },
    })
  ).id;
  hiddenGame = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: system,
      data: {
        title: "未发布社群" + stamp,
        slug: slug + "-hidden",
        _status: "draft",
        demo: true,
      },
    })
  ).id;
  admin = await createUser(
    "iconadmin",
    ["member"],
    [{ game, status: "active", publishContent: false }],
  );
  member = await createUser("iconmember", ["member"]);
  other = await createUser(
    "iconother",
    ["communityAdmin"],
    [{ game: hiddenGame, status: "active" }],
  );
  vice = await createUser("iconvice", ["vicePresident"]);
  leader = await createUser("iconleader", ["president"]);
  stale = await createUser(
    "iconstale",
    ["member"],
    [{ game, status: "active" }],
  );
  source =
    "data:image/png;base64," +
    (
      await sharp({
        create: {
          width: 120,
          height: 80,
          channels: 4,
          background: "#7646bc80",
        },
      })
        .png()
        .toBuffer()
    ).toString("base64");
});
afterAll(async () => {
  if (p) await p.destroy();
});
const input = () => ({
  slug,
  source,
  crop: defaultIconCrop,
  credit: "合成测试",
  revision,
});

describe("community artwork on real Payload/PostgreSQL", () => {
  it("lets active officers without content-publish permission save their community icon", async () => {
    expect(
      (await getCommunityIconEditor(p, admin, { slug })).source,
    ).toBeNull();
    const result = await saveCommunityIcon(p, admin, input());
    revision = result.revision;
    preservedSource = result.source;
    expect(
      await sharp((await readCommunityIcon(p, slug)).bytes).metadata(),
    ).toMatchObject({
      format: "webp",
      width: 512,
      height: 512,
      hasAlpha: true,
    });
    expect(await getCommunityIconEditor(p, admin, { slug })).toMatchObject({
      revision,
      source: preservedSource,
      crop: defaultIconCrop,
    });
  });
  it("retains the original on recrop and returns a versioned image with scoped edit visibility", async () => {
    const result = await saveCommunityIcon(p, admin, {
      ...input(),
      source: undefined,
      crop: { x: 0, y: 100, zoom: 2 },
    });
    expect(result.source).toBe(preservedSource);
    expect(result.revision).not.toBe(revision);
    revision = result.revision;
    const header = await getCommunityHeader(p, member, { slug });
    expect(header.card.cover?.src).toContain("/api/game-icons/" + slug + "?v=");
    expect(header.card.viewer?.canManageIcon).toBe(false);
    const own = await getCommunities(p, admin, { q: "图标合成社群" + stamp });
    expect(own.docs[0].viewer?.canManageIcon).toBe(true);
    expect(JSON.stringify(own)).not.toContain("data:image");
  });
  it("rejects anonymous, unrelated and revoked users using current account state", async () => {
    for (const user of [null, member, other]) {
      await expect(saveCommunityIcon(p, user, input())).rejects.toMatchObject({
        status: user ? 403 : 401,
      });
      await expect(
        getCommunityIconEditor(p, user, { slug }),
      ).rejects.toMatchObject({ status: user ? 403 : 401 });
    }
    await p.update({
      collection: "users",
      id: stale.id,
      overrideAccess: true,
      context: system,
      data: {
        communityOffices: stale.communityOffices!.map((office) => ({
          ...office,
          status: "revoked" as const,
        })),
      },
    });
    await expect(saveCommunityIcon(p, stale, input())).rejects.toMatchObject({
      status: 403,
    });
    expect((await readCommunityIcon(p, slug)).revision).toBe(revision);
  });
  it("allows platform leaders and refuses suspended accounts", async () => {
    for (const user of [vice, leader])
      expect((await getCommunityIconEditor(p, user, { slug })).revision).toBe(
        revision,
      );
    revision = (await saveCommunityIcon(p, vice, input())).revision;
    await p.update({
      collection: "users",
      id: stale.id,
      overrideAccess: true,
      context: system,
      data: { accountStatus: "suspended" },
    });
    await expect(
      getCommunityIconEditor(p, stale, { slug }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects concurrent stale editor versions", async () => {
    await expect(
      saveCommunityIcon(p, admin, { ...input(), revision: "" }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await readCommunityIcon(p, slug)).revision).toBe(revision);
  });
  it("blocks raw collection writes and hides original bytes from unrelated readers", async () => {
    const icons = await p.find({
      collection: "community-icons",
      user: admin,
      overrideAccess: false,
      depth: 0,
    });
    const icon = icons.docs.find((row) => Number(row.game) === game)!;
    await expect(
      p.update({
        collection: "community-icons",
        id: icon.id,
        user: admin,
        overrideAccess: false,
        data: { credit: "bypass" },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      p.create({
        collection: "community-icons",
        user: vice,
        overrideAccess: false,
        data: {
          game: hiddenGame,
          source,
          image: source,
          crop: defaultIconCrop,
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await p.find({
          collection: "community-icons",
          user: other,
          overrideAccess: false,
        })
      ).docs,
    ).toHaveLength(0);
    await expect(
      p.find({
        collection: "community-icons",
        user: null,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const publicResult = await p.find({
      collection: "community-icons",
      user: null,
      overrideAccess: false,
      context: { publicCommunityIcon: game },
      select: { source: true, crop: true, updatedBy: true },
    });
    for (const field of ["source", "crop", "updatedBy"])
      expect(publicResult.docs[0]).not.toHaveProperty(field);
  });
  it("preserves pending drafts and published game descriptions", async () => {
    await p.update({
      collection: "games",
      id: game,
      user: leader,
      overrideAccess: false,
      draft: true,
      data: { summary: "未发布的新介绍", _status: "draft" },
    });
    revision = (
      await saveCommunityIcon(p, admin, {
        ...input(),
        source: undefined,
        crop: { x: 75, y: 50, zoom: 1.5 },
      })
    ).revision;
    const draft = await p.findByID({
      collection: "games",
      id: game,
      user: leader,
      overrideAccess: false,
      draft: true,
    });
    const published = await p.findByID({
      collection: "games",
      id: game,
      user: null,
      overrideAccess: false,
      draft: false,
    });
    expect(draft.summary).toBe("未发布的新介绍");
    expect(published.summary).toBe("已发布介绍");
    expect(published._status).toBe("published");
  });
  it("does not serve or edit unpublished communities", async () => {
    await expect(readCommunityIcon(p, slug + "-hidden")).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      saveCommunityIcon(p, vice, {
        ...input(),
        slug: slug + "-hidden",
        revision: "",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("image validation and geometry", () => {
  it("rejects false MIME, oversize images and invalid crop coordinates", async () => {
    for (const invalid of [
      "data:image/png;base64," + Buffer.from("<svg />").toString("base64"),
      "https://example.invalid/a.png",
      "data:image/png;base64," +
        Buffer.alloc(4 * 1024 * 1024 + 1).toString("base64"),
    ])
      await expect(
        prepareCommunityIcon(invalid, defaultIconCrop),
      ).rejects.toMatchObject({ status: 400 });
    for (const crop of [
      { x: -1, y: 0, zoom: 1 },
      { x: 50, y: 50, zoom: 0 },
      { x: 50, y: 101, zoom: 2 },
      { x: NaN, y: 50, zoom: 1 },
    ])
      await expect(prepareCommunityIcon(source, crop)).rejects.toMatchObject({
        status: 400,
      });
  });
  it("renders the selected edge of a non-square image", async () => {
    const red = await sharp({
      create: { width: 80, height: 80, channels: 4, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const blue = await sharp({
      create: { width: 80, height: 80, channels: 4, background: "#0000ff" },
    })
      .png()
      .toBuffer();
    const wide = await sharp({
      create: { width: 160, height: 80, channels: 4, background: "#0000" },
    })
      .composite([
        { input: red, left: 0, top: 0 },
        { input: blue, left: 80, top: 0 },
      ])
      .png()
      .toBuffer();
    for (const [x, channel] of [
      [0, 0],
      [100, 2],
    ]) {
      const result = await prepareCommunityIcon(
        "data:image/png;base64," + wide.toString("base64"),
        { x, y: 50, zoom: 1 },
      );
      const stats = await sharp(
        Buffer.from(result.image.split(",")[1], "base64"),
      ).stats();
      expect(stats.channels[channel].mean).toBeGreaterThan(240);
    }
    expect(iconCropRect(120, 80, { x: 100, y: 100, zoom: 2 })).toEqual({
      left: 80,
      top: 40,
      width: 40,
      height: 40,
    });
  });
  it("provides default artwork for all five requested games", () => {
    for (const title of [
      "王者荣耀",
      "CS2",
      "星露谷物语",
      "蛋仔派对",
      "英雄联盟",
    ])
      expect(defaultGameIcon(title, "")?.src).toMatch(/^https:\/\//);
    expect(defaultGameIcon("新社群", "unknown")).toBeNull();
  });
});
