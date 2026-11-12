import "dotenv/config";
import assert from "node:assert/strict";
import {
  createLocalReq,
  getPayload,
  type CollectionSlug,
  type RequiredDataFromCollectionSlug,
} from "payload";
import config from "../src/payload.config";
import { emptySignup, normalizeSignup } from "../src/lib/signup-schema";
import { formVersion } from "../src/lib/activity-signups";
import { getMe, getMySignups } from "../src/lib/v2/account";
import {
  defaultTeamForm,
  normalizeTeamForm,
  teamRecruitmentInfo,
} from "../src/lib/team-core";

// Synthetic records belong only to the local preview member, never a school account.
const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
assert.equal(process.env.APP_ENV, "development");
assert.equal(process.env.PIXEL_PREVIEW_ACCOUNT_SEED, "1");
assert.ok(["127.0.0.1", "localhost"].includes(database.hostname));
assert.equal(database.port, "55439");
assert.ok(!process.env.SMTP_HOST && !process.env.S3_BUCKET);
const resolved = await config;
resolved.typescript.autoGenerate = false;
resolved.admin.importMap.autoGenerate = false;
const p = await getPayload({ config: resolved });
try {
  const users = await p.find({
    collection: "users",
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { email: { equals: "pixel-preview-1112@example.invalid" } },
  });
  const member = users.docs[0];
  assert.ok(member, "请先创建本地体验账号");
  assert.deepEqual(member.roles, ["member"]);
  const transactionID = await p.db.beginTransaction();
  assert.ok(transactionID != null, "本地演示数据需要事务");
  const req = await createLocalReq(
    {
      user: { ...member, collection: "users" },
      context: { system: true, teamCoreWrite: true, submitEventSignup: true },
    },
    p,
  );
  req.transactionID = transactionID;
  const prefix = "pixel-account-preview";
  const date = (days: number, hour = 6) => {
    const value = new Date();
    value.setUTCDate(value.getUTCDate() + days);
    value.setUTCHours(hour, 0, 0, 0);
    return value.toISOString();
  };
  async function ensure<C extends CollectionSlug>(
    collection: C,
    field: string,
    key: string,
    data: RequiredDataFromCollectionSlug<C>,
  ) {
    const found = await p.find({
      collection,
      req,
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { [field]: { equals: key } },
    });
    if (found.docs[0]) return Number(found.docs[0].id);
    return Number(
      (await p.create({ collection, req, overrideAccess: true, data })).id,
    );
  }
  try {
    const game = await ensure("games", "slug", `${prefix}-game`, {
      title: "演示 · 英雄联盟",
      slug: `${prefix}-game`,
      demo: true,
      _status: "published",
      summary: "本地界面体验用的虚构社群，不是真实社群或联系方式",
    });
    const form = normalizeSignup({
      ...emptySignup,
      enabled: true,
      intro:
        "本地演示问卷，仅用于查看填写、报名回执和修改界面，请勿填写真实个人资料",
      questions: [
        {
          id: "position",
          label: "偏好的游戏位置",
          type: "single",
          required: true,
          options: ["上路", "中路", "打野", "射手", "辅助"],
        },
        {
          id: "availability",
          label: "可参与的时间",
          type: "text",
          required: true,
          options: [],
        },
      ],
    });
    for (const [key, title, days, type, closed, location] of [
      ["match", "演示 · 周末峡谷组队赛", 2, "比赛", false, "演示活动室 A"],
      ["watch", "演示 · 校园观赛之夜", 5, "观赛", true, "演示观赛空间"],
      ["past", "演示 · 同好交流回顾", -3, "交流", true, "演示活动室 B"],
    ] as const) {
      const signupForm = normalizeSignup({ ...form, closed });
      const event = await ensure("events", "slug", `${prefix}-${key}`, {
        title,
        slug: `${prefix}-${key}`,
        demo: true,
        _status: "published",
        game,
        type,
        startAt: date(days),
        endAt: date(days, 9),
        location,
        summary: "虚构活动与报名记录，用于查看登录后的界面，不代表实际安排",
        signupForm,
      });
      await ensure(
        "event-signups",
        "dedupeKey",
        `events:${event}:${member.id}`,
        {
          activityType: "events",
          activityID: event,
          dedupeKey: `events:${event}:${member.id}`,
          member: member.id,
          memberName: member.name,
          game,
          eventTitle: title,
          formVersion: formVersion(signupForm),
          questions: signupForm.questions,
          answers: { position: "辅助", availability: "演示：周末下午可参与" },
        },
      );
    }
    for (const [key, title, status, reviewNote] of [
      [
        "returned",
        "演示 · 校园挑战队建队申请",
        "returned",
        "演示反馈：请补充每周训练时间与队员分工后重新提交",
      ],
      ["pending", "演示 · 新生交流队建队申请", "pending", ""],
    ] as const) {
      await ensure(
        "team-establishment-applications",
        "requestKey",
        `${prefix}-${key}`,
        {
          title,
          game,
          applicant: member.id,
          requestKey: `${prefix}-${key}`,
          status,
          reviewNote,
          reason:
            "本地演示：每周进行两次训练，比赛与同好交流并重，所有资料均为虚构",
        },
      );
    }
    const establishment = await ensure(
      "team-establishment-applications",
      "requestKey",
      `${prefix}-established`,
      {
        title: "演示 · 紫荆像素队",
        game,
        applicant: member.id,
        requestKey: `${prefix}-established`,
        status: "pending",
        reason:
          "本地界面展示用的虚构队伍，每周末进行配合练习，不代表实际建队或学校代表队",
      },
    );
    const team = await ensure("teams", "slug", `${prefix}-team`, {
      title: "演示 · 紫荆像素队",
      slug: `${prefix}-team`,
      game,
      demo: true,
      _status: "published",
      teamStatus: "active",
      establishmentApplication: establishment,
      summary: "虚构队伍，用于预览队员卡、入队申请与个人简介入口",
    });
    const application = await p.findByID({
      collection: "team-establishment-applications",
      id: establishment,
      req,
      overrideAccess: true,
      depth: 0,
    });
    if (!application.team)
      await p.update({
        collection: "team-establishment-applications",
        id: establishment,
        req,
        overrideAccess: true,
        data: {
          team,
          status: "approved",
          reviewNote: "演示记录：建队资料已通过",
        },
      });
    const teamForm = normalizeTeamForm({
      ...defaultTeamForm,
      intro: "本地演示选拔，仅供体验申请和回执界面，请勿填写真实资料",
    });
    const teamAnswers = {
      gameID: "演示玩家#1112",
      position: "辅助",
      experience: "演示：参与过校园友谊赛，希望与队友一起训练",
      availability: "演示：周末下午可参与",
      contact: "pixel-preview-1112@example.invalid",
    };
    for (const [key, status] of [
      ["joined", "approved"],
      ["draft", "draft"],
    ] as const) {
      const recruitment = await ensure(
        "team-recruitments",
        "title",
        `演示 · 像素队${key === "joined" ? "首期" : "冬季"}选拔`,
        {
          title: `演示 · 像素队${key === "joined" ? "首期" : "冬季"}选拔`,
          team,
          game,
          status: key === "joined" ? "closed" : "open",
          signupForm: teamForm,
          createdBy: member.id,
        },
      );
      // Repair only earlier synthetic fixtures whose activity form fails the team contract.
      const batch = await p.findByID({
        collection: "team-recruitments",
        id: recruitment,
        req,
        overrideAccess: true,
        depth: 0,
      });
      try {
        normalizeTeamForm(batch.signupForm);
      } catch {
        await p.update({
          collection: "team-recruitments",
          id: recruitment,
          req,
          overrideAccess: true,
          data: { signupForm: teamForm },
        });
      }
      const join = await ensure(
        "team-join-applications",
        "requestKey",
        `${prefix}-${key}`,
        {
          title: `演示 · 像素队${key === "joined" ? "首期录取" : "冬季选拔草稿"}`,
          team,
          game,
          recruitment,
          applicant: member.id,
          requestKey: `${prefix}-${key}`,
          status,
          formVersion: formVersion(teamForm),
          formSnapshot: teamForm,
          answers: teamAnswers,
          reviewNote:
            key === "joined" ? "演示反馈：已通过本次选拔，欢迎加入训练" : "",
        },
      );
      const application = await p.findByID({
        collection: "team-join-applications",
        id: join,
        req,
        overrideAccess: true,
        depth: 0,
      });
      try {
        normalizeTeamForm(application.formSnapshot);
      } catch {
        await p.update({
          collection: "team-join-applications",
          id: join,
          req,
          overrideAccess: true,
          data: {
            formVersion: formVersion(teamForm),
            formSnapshot: teamForm,
            answers: teamAnswers,
          },
        });
      }
      const info = await teamRecruitmentInfo(p, member, recruitment, req);
      assert.equal(info.own?.id, join);
      if (key === "joined")
        await ensure(
          "team-memberships",
          "membershipKey",
          `${team}:${member.id}`,
          {
            title: "演示 · 像素队成员",
            team,
            game,
            member: member.id,
            membershipKey: `${team}:${member.id}`,
            status: "active",
            joinedAt: date(-7),
            sourceApplication: join,
            grantedBy: member.id,
          },
        );
    }
    await p.db.commitTransaction(transactionID);
  } catch (error) {
    await p.db.rollbackTransaction(transactionID);
    throw error;
  }
  const fresh = await p.findByID({
    collection: "users",
    id: member.id,
    overrideAccess: true,
    depth: 0,
  });
  assert.deepEqual(fresh.roles, ["member"]);
  const me = await getMe(p, fresh);
  const receipts = await getMySignups(p, fresh);
  assert.ok(
    me.todo.length >= 2 &&
      me.upcoming.length >= 2 &&
      me.applications.length >= 5,
  );
  assert.ok(me.memberships.length >= 1 && receipts.totalDocs >= 3);
  console.log(
    JSON.stringify({
      todo: me.todo.length,
      upcoming: me.upcoming.length,
      applications: me.counts.applications,
      memberships: me.memberships.length,
      signups: receipts.totalDocs,
    }),
  );
} finally {
  await p.destroy();
}
process.exit(0);
