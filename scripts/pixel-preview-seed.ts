import "dotenv/config";
import assert from "node:assert/strict";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";

// Only the developer's local database may receive these explicitly marked fixtures.
const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
assert.equal(process.env.APP_ENV, "development");
assert.equal(process.env.PIXEL_PREVIEW_SEED, "1");
assert.ok(["127.0.0.1", "localhost"].includes(database.hostname));
assert.ok(!process.env.SMTP_HOST && !process.env.S3_BUCKET);
const resolved = await config;
resolved.typescript.autoGenerate = false;
resolved.admin.importMap.autoGenerate = false;
const p = await getPayload({ config: resolved });
const context = { system: true };
const common = { demo: true, _status: "published" as const };
const date = (days: number, hour = 6) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
};
const body = (text: string) => ({
  root: {
    type: "root",
    version: 1,
    format: "" as const,
    indent: 0,
    direction: null,
    children: [
      {
        type: "paragraph",
        version: 1,
        format: "" as const,
        indent: 0,
        direction: null,
        children: [
          {
            type: "text",
            version: 1,
            text,
            format: 0,
            detail: 0,
            mode: "normal",
            style: "",
          },
        ],
      },
    ],
  },
});
try {
  for (const [slug, title, summary] of [
    [
      "pixel-preview-welcome",
      "新同学，从找到你的游戏社群开始",
      "演示公告：认识游戏社群、了解参与方式，找到一起玩的队友",
    ],
    [
      "pixel-preview-volunteers",
      "活动的精彩，也有幕后的一份热爱",
      "演示公告：从赛务、摄影到内容记录，看看你感兴趣的筹备工作",
    ],
    [
      "pixel-preview-calendar",
      "本月活动指南：比赛、观赛与同好交流",
      "演示公告：在日程中按类型查找活动，查看时间和参与说明",
    ],
  ]) {
    const existing = await p.find({
      collection: "announcements",
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    });
    if (!existing.docs.length)
      await p.create({
        collection: "announcements",
        overrideAccess: true,
        context,
        data: {
          ...common,
          slug,
          title,
          summary,
          publishedAt: date(-1),
          body: body(
            `${summary}。这条内容用于本地界面预览，活动信息与参与方式均为示例。`,
          ),
        },
      });
  }
  const old = await p.find({
    collection: "events",
    where: {
      and: [
        { slug: { equals: "demo-club-meetup" } },
        { demo: { equals: true } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  if (old.docs[0])
    await p.update({
      collection: "events",
      id: old.docs[0].id,
      overrideAccess: true,
      context,
      data: { startAt: date(2), endAt: date(2, 9), registrationClosed: true },
    });
  for (const [slug, title, type, days, location] of [
    ["pixel-preview-match", "周末组队，来打一场", "比赛", 3, "演示活动室 A"],
    ["pixel-preview-watch", "一起观赛，把气氛拉满", "观赛", 5, "演示观赛空间"],
    [
      "pixel-preview-practice",
      "配合练习，一起找到节奏",
      "训练",
      7,
      "演示训练空间",
    ],
  ] as const) {
    const existing = await p.find({
      collection: "events",
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    });
    if (!existing.docs.length)
      await p.create({
        collection: "events",
        overrideAccess: true,
        context,
        data: {
          ...common,
          slug,
          title,
          type,
          startAt: date(days),
          endAt: date(days, 9),
          location,
          summary: "本地演示活动，用于查看日程与活动详情的排版",
          registrationClosed: true,
          channelText: "演示活动，无实际报名安排",
          body: body(
            "这是一场用于界面预览的虚构活动。这里展示活动简介、时间、地点和参与须知；正式内容由社团负责人发布。",
          ),
        },
      });
  }
  const photos = [];
  for (const [index, file] of ["fistbump", "match", "trophy"].entries()) {
    const alt = `演示影像 · 公开大学生赛事资料 ${index + 1}`;
    const existing = await p.find({
      collection: "media",
      where: { and: [{ alt: { equals: alt } }, { demo: { equals: true } }] },
      limit: 1,
      overrideAccess: true,
    });
    const image =
      existing.docs[0] ||
      (await p.create({
        collection: "media",
        overrideAccess: true,
        context,
        filePath: path.resolve(`public/pixel-campus/esports-${file}.jpg`),
        data: {
          alt,
          credit:
            "公开赛事图片来源：https://www.gdec.net.cn/2026/actives/newsdetail?id=1320&lang=zh；仅本地设计演示",
          demo: true,
        },
      }));
    photos.push({
      image: image.id,
      caption: "公开赛事资料 · 用于本地版式演示，非虚构活动的现场记录",
    });
  }
  const album = await p.find({
    collection: "albums",
    where: { slug: { equals: "pixel-preview-album" } },
    limit: 1,
    overrideAccess: true,
  });
  if (!album.docs.length)
    await p.create({
      collection: "albums",
      overrideAccess: true,
      context,
      data: {
        ...common,
        slug: "pixel-preview-album",
        title: "演示 · 赛场瞬间，一起上场",
        summary: "碰拳、专注与庆祝：用公开赛事影像预览相册版式",
        cover: photos[0].image,
        date: date(-2),
        photos,
      },
    });
  const news = await p.find({
    collection: "news",
    where: { slug: { equals: "pixel-preview-story" } },
    limit: 1,
    overrideAccess: true,
  });
  if (!news.docs.length)
    await p.create({
      collection: "news",
      overrideAccess: true,
      context,
      data: {
        ...common,
        slug: "pixel-preview-story",
        title: "演示 · 从第一次组队到默契配合",
        type: "回顾",
        publishedAt: date(-1),
        summary: "一篇活动回顾的内容示例，展示图片、摘要与正文的阅读体验",
        cover: photos[1].image,
        body: body(
          "组队、沟通、配合，然后一起复盘。本篇为本地界面演示内容，配图为公开赛事资料。",
        ),
      },
    });
  const about = await p.find({
    collection: "pages",
    where: { key: { equals: "about" } },
    limit: 1,
    overrideAccess: true,
  });
  if (!about.docs.length)
    await p.create({
      collection: "pages",
      overrideAccess: true,
      context,
      data: {
        ...common,
        key: "about",
        slug: "pixel-preview-about",
        title: "关于紫荆",
        summary: "一起玩，认真上场",
        body: body(
          "以下为本地设计演示文案：在校园里找到同频的队友，让每一种热爱都有主场。",
        ),
        sections: [
          {
            heading: "一起玩，也一起认真",
            text: "演示内容：从同好交流到组队训练，从一起观赛到校园比赛，在熟悉的游戏里认识新的朋友。",
          },
          {
            heading: "台前的高光，幕后的默契",
            text: "演示内容：除了上场比赛，也可以参与赛务、摄影与内容记录，在不同的位置共同完成一次活动。",
          },
          {
            heading: "从你的热爱开始",
            text: "演示内容：浏览社群与日程，了解感兴趣的活动。正式介绍与组织信息由负责人在后台维护。",
          },
        ],
      },
    });
  console.log(
    "本地演示内容已补齐：公告、日程、动态、影像与关于页面；重复执行不新增重复记录。",
  );
} finally {
  await p.destroy();
}

process.exit(0);
