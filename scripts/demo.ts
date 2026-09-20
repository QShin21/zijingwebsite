import "dotenv/config";
import { getPayload, type CollectionSlug } from "payload";
import config from "../src/payload.config";
if (!["development", "staging"].includes(process.env.APP_ENV || ""))
  throw new Error("演示导入/清理仅限 development 或 staging");
const p = await getPayload({ config });
const context = { system: true };
const collections: CollectionSlug[] = [
  "albums",
  "news",
  "honors",
  "seasons",
  "recruitment",
  "events",
  "teams",
  "games",
];
if (process.argv[2] === "clean") {
  for (const collection of collections)
    await p.delete({
      collection,
      where: { demo: { equals: true } },
      overrideAccess: true,
      context,
    });
  console.log("仅 demo=true 的演示内容已清理；媒体不自动删除。");
} else {
  const existing = await p.find({
    collection: "events",
    where: { slug: { equals: "demo-club-meetup" } },
    overrideAccess: true,
  });
  if (existing.docs.length) console.log("演示已存在，跳过重复导入。");
  else {
    const game = await p.create({
      collection: "games",
      overrideAccess: true,
      context,
      data: {
        title: "演示 · 游戏项目",
        slug: "demo-game",
        demo: true,
        _status: "published",
      },
    });
    const team = await p.create({
      collection: "teams",
      overrideAccess: true,
      context,
      data: {
        title: "演示 · 社团队伍",
        slug: "demo-team",
        game: game.id,
        demo: true,
        _status: "published",
        summary: "用于验证界面的虚构队伍，不代表真实社团或学校队伍。",
      },
    });
    const season = await p.create({
      collection: "seasons",
      overrideAccess: true,
      context,
      data: {
        title: "演示 · 测试赛季",
        slug: "demo-season",
        team: team.id,
        season: "测试赛季",
        demo: true,
        _status: "published",
        members: [
          { displayName: "演示昵称", position: "测试位置", consent: true },
        ],
      },
    });
    const event = await p.create({
      collection: "events",
      overrideAccess: true,
      context,
      data: {
        title: "演示 · 社团交流活动",
        slug: "demo-club-meetup",
        demo: true,
        _status: "published",
        game: game.id,
        team: team.id,
        type: "交流",
        summary: "这是一条演示记录，仅用于展示内容发布与报名状态。",
        startAt: "2099-09-20T06:00:00Z",
        endAt: "2099-09-20T09:00:00Z",
        location: "演示场地（非真实安排）",
        registrationStart: "2099-09-01T00:00:00Z",
        registrationEnd: "2099-09-19T16:00:00Z",
        channelText: "演示内容不接受实际报名。",
      },
    });
    await p.create({
      collection: "honors",
      overrideAccess: true,
      context,
      data: {
        title: "演示 · 荣誉档案样例",
        slug: "demo-honor",
        team: team.id,
        season: season.id,
        game: game.id,
        competition: "演示赛事",
        placing: "演示名次",
        demo: true,
        _status: "draft",
        verified: false,
      },
    });
    for (const kind of ["members", "teams", "staff"] as const)
      await p.create({
        collection: "recruitment",
        overrideAccess: true,
        context,
        data: {
          title: `演示 · ${kind} 招新批次`,
          slug: `demo-${kind}`,
          kind,
          demo: true,
          _status: "published",
          archived: true,
          requirements: "仅展示批次结构，无实际招新安排。",
          positions: [
            {
              name: "演示岗位",
              duties: "展示职责字段",
              commitment: "由真实内容负责人填写",
            },
          ],
        },
      });
    await p.create({
      collection: "news",
      overrideAccess: true,
      context,
      data: {
        title: "演示 · 交流活动回顾",
        slug: "demo-news",
        event: event.id,
        demo: true,
        _status: "published",
        type: "回顾",
      },
    });
    await p.create({
      collection: "albums",
      overrideAccess: true,
      context,
      data: {
        title: "演示 · 活动相册",
        slug: "demo-album",
        event: event.id,
        demo: true,
        _status: "published",
        summary: "无授权照片，保持空相册。",
      },
    });
    console.log("演示资料导入完成；不含真实荣誉或成员。");
  }
}
await p.destroy();

process.exit(0);
