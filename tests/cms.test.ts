import "dotenv/config";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
let p: Payload,
  editor: User,
  publisher: User,
  leader: User,
  team: number,
  other: number,
  event: number;
const suffix = Date.now().toString(),
  context = { system: true },
  password = randomBytes(24).toString("hex");
const users: number[] = [];
beforeAll(async () => {
  if (process.env.APP_ENV !== "development")
    throw new Error("Integration test requires development database");
  p = await getPayload({ config });
  for (const [kind, role] of [
    ["editor", "communityAdmin"], ["publisher", "vicePresident"], ["leader", "communityAdmin"],
  ] as const) {
    const u = await p.create({
      collection: "users",
      overrideAccess: true,
      context,
      data: {
        email: `test-${kind}-${suffix}@example.invalid`,
        password,
        roles: [role],
        name: `${kind}-${suffix}`,

      },
    });
    users.push(u.id);
    if (kind === "editor") editor = u;
    if (kind === "publisher") publisher = u;
    if (kind === "leader") leader = u;
  }
  team = (
    await p.create({
      collection: "teams",
      overrideAccess: true,
      context,
      data: {
        title: "测试所属队伍",
        slug: `test-team-${suffix}`,
        demo: true,
        _status: "published",
      },
    })
  ).id;
  other = (
    await p.create({
      collection: "teams",
      overrideAccess: true,
      context,
      data: {
        title: "测试其他队伍",
        slug: `test-other-${suffix}`,
        demo: true,
        _status: "published",
      },
    })
  ).id;
  leader = await p.update({
    collection: "users",
    id: leader.id,
    overrideAccess: true,
    context,
    data: { teams: [team] },
  });
});
afterAll(async () => {
  if (!p) return;
  for (const collection of ["honors", "seasons", "events", "teams"] as const)
    await p.delete({
      collection,
      overrideAccess: true,
      where: { slug: { contains: suffix } },
      context,
    });
  for (const id of users)
    await p.delete({ collection: "users", id, overrideAccess: true, context });
  await p.destroy();
});
describe.sequential("真实 PostgreSQL / Payload 权限链路", () => {
  it("公众不能建立账号或读取用户和审计", async () => {
    await expect(
      p.create({
        collection: "users",
        overrideAccess: false,
        data: { email: "attacker@example.invalid", password, roles: ["president"], name: "攻击测试" },
      }),
    ).rejects.toThrow();
    expect(
      (await p.find({ collection: "users", overrideAccess: false, user: null }))
        .docs,
    ).toHaveLength(0);
    await expect(
      p.find({ collection: "audit", overrideAccess: false, user: null }),
    ).rejects.toThrow();
  });
  it("编辑草稿、鉴权预览、匿名不可见", async () => {
    const doc = await p.create({
      collection: "events",
      overrideAccess: false,
      user: editor,
      draft: true,
      data: {
        title: "原始活动标题",
        slug: `test-event-${suffix}`,
        demo: true,
        internalNotes: "private-note",
      },
    });
    event = doc.id;
    expect(
      (
        await p.find({
          collection: "events",
          overrideAccess: false,
          user: null,
          where: { id: { equals: event } },
        })
      ).docs,
    ).toHaveLength(0);
    expect(
      (
        await p.findByID({
          collection: "events",
          id: event,
          overrideAccess: false,
          user: editor,
          draft: true,
        })
      ).title,
    ).toBe("原始活动标题");
  });
  it("编辑不能发布，发布负责人可以发布", async () => {
    await expect(
      p.update({
        collection: "events",
        id: event,
        overrideAccess: false,
        user: editor,
        data: { _status: "published" },
      }),
    ).rejects.toThrow();
    await p.update({ collection: "events", id: event, overrideAccess: false,
      user: editor, draft: true, data: { reviewState: "submitted" } });
    await p.update({
      collection: "events",
      id: event,
      overrideAccess: false,
      user: publisher,
      data: { _status: "published" },
    });
    const doc = await p.findByID({
      collection: "events",
      id: event,
      overrideAccess: false,
      user: null,
    });
    expect(doc.title).toBe("原始活动标题");
    expect(doc.internalNotes).toBeUndefined();
  });
  it("已发布内容的未审核修改不影响正式版本", async () => {
    await p.update({
      collection: "events",
      id: event,
      overrideAccess: false,
      user: editor,
      draft: true,
      data: { title: "未审核的新标题", _status: "draft" },
    });
    expect(
      (
        await p.findByID({
          collection: "events",
          id: event,
          overrideAccess: false,
          user: null,
        })
      ).title,
    ).toBe("原始活动标题");
    expect(
      (
        await p.findByID({
          collection: "events",
          id: event,
          overrideAccess: false,
          user: publisher,
          draft: true,
        })
      ).title,
    ).toBe("未审核的新标题");
  });
  it("角色字段和账号管理不能提权", async () => {
    await expect(p.update({
      collection: "users",
      id: editor.id,
      overrideAccess: false,
      user: editor,
      data: { roles: ["president"], teams: [other] },
    })).rejects.toThrow();
    const u = await p.findByID({
      collection: "users",
      id: editor.id,
      overrideAccess: true,
    });
    expect(u.roles).toEqual(["communityAdmin"]);
    expect(u.teams || []).toEqual([]);
    await expect(
      p.create({
        collection: "users",
        overrideAccess: false,
        user: publisher,
        data: { email: "evil@example.invalid", password, roles: ["president"], name: "越权测试" },
      }),
    ).rejects.toThrow();
  });
  it("不传 draft 参数仍保存草稿，匿名 draft 查询不会泄露未审核版本", async () => {
    await p.update({
      collection: "events",
      id: event,
      overrideAccess: false,
      user: editor,
      data: { title: "强制草稿测试" },
    });
    expect(
      (
        await p.findByID({
          collection: "events",
          id: event,
          user: null,
          overrideAccess: false,
        })
      ).title,
    ).toBe("原始活动标题");
    const result = await p.find({
      collection: "events",
      user: null,
      overrideAccess: false,
      draft: true,
      where: { id: { equals: event } },
    });
    expect(JSON.stringify(result)).not.toContain("强制草稿测试");
  });
  it("版本恢复受发布权限控制且真实恢复旧版本", async () => {
    const versions = await p.findVersions({
      collection: "events",
      overrideAccess: false,
      user: publisher,
      where: { parent: { equals: event } },
      limit: 20,
    });
    const target = versions.docs.find(
      (v) =>
        v.version.title === "原始活动标题" && v.version._status === "published",
    );
    expect(target).toBeDefined();
    await expect(
      p.restoreVersion({
        collection: "events",
        id: String(target!.id),
        overrideAccess: false,
        user: editor,
      }),
    ).rejects.toThrow();
    await p.restoreVersion({
      collection: "events",
      id: String(target!.id),
      overrideAccess: false,
      user: publisher,
    });
    expect(
      (
        await p.findByID({
          collection: "events",
          id: event,
          overrideAccess: false,
          user: null,
        })
      ).title,
    ).toBe("原始活动标题");
  });
  it("站点全局仅管理员可改，富文本拒绝脚本节点", async () => {
    await expect(
      p.updateGlobal({
        slug: "site",
        overrideAccess: false,
        user: editor,
        data: { heroTitle: "未授权" },
      }),
    ).rejects.toThrow();
    await expect(
      p.update({
        collection: "events",
        id: event,
        overrideAccess: false,
        user: publisher,
        data: {
          body: {
            root: {
              type: "root",
              version: 1,
              direction: null,
              format: "",
              indent: 0,
              children: [
                { type: "html", version: 1, html: "<script>alert(1)</script>" },
              ],
            },
          },
        },
      }),
    ).rejects.toThrow();
  });
  it("社群管理员可提交全站赛季草稿，但不能改动他人草稿", async () => {
    const season = await p.create({
      collection: "seasons",
      overrideAccess: false,
      user: leader,
      draft: true,
      data: {
        title: "赛季",
        slug: `test-season-${suffix}`,
        season: "测试",
        team,
        demo: true,
      },
    });
    await p.update({ collection: "seasons", id: season.id,
      overrideAccess: false, user: leader, draft: true, data: { team: other } });
    await expect(
      p.update({
        collection: "teams",
        id: other,
        overrideAccess: false,
        user: leader,
        draft: true,
        data: { title: "越权" },
      }),
    ).rejects.toThrow();
    expect((await p.find({ collection: "seasons", overrideAccess: false,
      user: null, where: { id: { equals: season.id } } })).docs).toHaveLength(0);
  });
  it("历史荣誉仍需核验且不泄漏内部字段，新增和重新发布使用成员审核流程", async () => {
    const h = await p.create({
      collection: "honors",
      overrideAccess: true,
      context: { system: true },
      user: publisher,
      data: {
        title: "测试荣誉",
        slug: `test-honor-${suffix}`,
        team,
        competition: "测试",
        placing: "测试",
        _status: "published",
        verified: false,
        demo: true,
        internalNotes: "secret-proof",
      },
    });
    expect(
      (
        await p.find({
          collection: "honors",
          overrideAccess: false,
          user: null,
        })
      ).docs.some((d) => d.id === h.id),
    ).toBe(false);
    await expect(p.update({ collection: "honors", id: h.id, overrideAccess: false, user: publisher,
      data: { verified: true, sourceURL: "https://example.com/public-proof" } })).rejects.toThrow();
    await p.update({
      collection: "honors",
      id: h.id,
      overrideAccess: true,
      context: { system: true },
      user: publisher,
      data: { verified: true, sourceURL: "https://example.com/public-proof" },
    });
    const read = await p.findByID({
      collection: "honors",
      id: h.id,
      overrideAccess: false,
      user: null,
      depth: 3,
    });
    expect(JSON.stringify(read)).not.toContain("secret-proof");
  });
  it("危险报名链接被拒绝", async () => {
    await expect(
      p.update({
        collection: "events",
        id: event,
        overrideAccess: false,
        user: publisher,
        data: { registrationURL: "javascript:alert(1)" },
      }),
    ).rejects.toThrow();
  });
  it('新赛季和阵容变更不覆盖旧赛季及荣誉归属',async()=>{
    const old=await p.create({collection:'seasons',overrideAccess:false,user:publisher,data:{title:'历史赛季',slug:`test-history-${suffix}`,season:'历史',team,demo:true,_status:'published',members:[{displayName:'测试旧昵称',position:'旧位置',consent:true}]}});
    const current=await p.create({collection:'seasons',overrideAccess:false,user:publisher,data:{title:'当前赛季',slug:`test-current-${suffix}`,season:'当前',team,demo:true,_status:'published',members:[{displayName:'测试新昵称',position:'新位置',consent:true}]}});
    const honor=await p.create({collection:'honors',overrideAccess:true,context:{system:true},user:publisher,data:{title:'历史关联测试',slug:`test-historical-honor-${suffix}`,team,season:old.id,competition:'测试赛事',placing:'测试',verified:true,sourceURL:'https://example.com/public-source',demo:true,_status:'published'}});
    await p.update({collection:'seasons',id:current.id,overrideAccess:false,user:publisher,data:{members:[{displayName:'替补测试昵称',position:'新位置',consent:true}]}});
    expect((await p.findByID({collection:'seasons',id:old.id,overrideAccess:false,user:null})).members?.[0].displayName).toBe('测试旧昵称');
    expect((await p.findByID({collection:'honors',id:honor.id,overrideAccess:false,user:null,depth:0})).season).toBe(old.id);
    await expect(p.update({collection:'honors',id:honor.id,overrideAccess:false,user:publisher,data:{team:other}})).rejects.toThrow();
  });
  it("媒体真实类型与尺寸校验", async () => {
    await expect(
      p.create({
        collection: "media",
        overrideAccess: false,
        user: editor,
        data: { alt: "假图片", credit: "test" },
        file: {
          data: Buffer.from("<script>alert(1)</script>"),
          mimetype: "image/png",
          name: "fake.png",
          size: 25,
        },
      }),
    ).rejects.toThrow();
    const buffer = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#592a91" },
    })
      .png()
      .toBuffer();
    const img = await p.create({
      collection: "media",
      overrideAccess: false,
      user: editor,
      data: { alt: "测试图片", credit: "程序生成测试素材", demo: true },
      file: {
        data: buffer,
        mimetype: "image/png",
        name: `test-${suffix}.png`,
        size: buffer.length,
      },
    });
    expect(img.width).toBe(32);
    await p.delete({ collection: "media", id: img.id, overrideAccess: true });
  });
  it("修改 slug 创建重定向，撤下后公众不可读取", async () => {
    await p.update({
      collection: "events",
      id: event,
      overrideAccess: false,
      user: publisher,
      data: { _status: "published", slug: `test-renamed-${suffix}` },
    });
    expect(
      (
        await p.find({
          collection: "redirects",
          overrideAccess: false,
          user: null,
          where: { from: { equals: `/events/test-event-${suffix}` } },
        })
      ).docs,
    ).toHaveLength(1);
    await p.update({
      collection: "events",
      id: event,
      overrideAccess: false,
      user: publisher,
      data: { _status: "draft" },
    });
    expect(
      (
        await p.find({
          collection: "events",
          overrideAccess: false,
          user: null,
          where: { id: { equals: event } },
        })
      ).docs,
    ).toHaveLength(0);
  });
});
