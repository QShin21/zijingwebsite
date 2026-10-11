import "dotenv/config";
import { beforeAll, afterAll, it, expect } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { randomBytes } from "node:crypto";
import {
  activity,
  formVersion,
  saveSignupForm,
  submitSignup,
} from "../src/lib/activity-signups";
import {
  normalizeSignup,
  validateAnswers,
  type SignupForm,
} from "../src/lib/signup-schema";
let p: Payload,
  admin: User,
  member: User,
  other: User,
  manager: User,
  event: number,
  hidden: number,
  game: number,
  post: number;
const stamp = Date.now(),
  form: SignupForm = {
    enabled: true,
    closed: false,
    start: "",
    end: "",
    intro: "测试报名",
    questions: [
      { id: "name", label: "称呼", type: "text", required: true, options: [] },
      {
        id: "side",
        label: "分组",
        type: "single",
        required: true,
        options: ["A", "B"],
      },
      {
        id: "slots",
        label: "可参加时段",
        type: "multiple",
        required: true,
        options: ["上午", "下午"],
      },
      {
        id: "note",
        label: "备注",
        type: "textarea",
        required: false,
        options: [],
      },
    ],
  };
const answers = { name: "测试参与者", side: "A", slots: ["上午"], note: "" };
beforeAll(async () => {
  if (process.env.APP_ENV !== "development")
    throw new Error("Development only");
  p = await getPayload({ config });
  const user = (name: string, roles: User["roles"]) =>
    p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: name + stamp,
        email: randomBytes(8).toString("hex") + "@example.invalid",
        password: randomBytes(16).toString("hex"),
        roles,
      },
    });
  admin = await user("报名管理", ["vicePresident"]);
  member = await user("报名成员", ["member"]);
  other = await user("其他成员", ["member"]);
  manager = await user("项目管理", ["communityAdmin"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "报名测试项目",
        slug: "signup-game-" + stamp,
        _status: "published",
      },
    })
  ).id;
  manager = await p.update({
    collection: "users",
    id: manager.id,
    overrideAccess: true,
    context: { system: true },
    data: { communities: [game] },
  });
  event = (
    await p.create({
      collection: "events",
      overrideAccess: false,
      user: admin,
      context: { manageSignupForm: true },
      data: {
        title: "报名测试活动",
        slug: "signup-" + stamp,
        _status: "published",
        signupForm: form,
      },
    })
  ).id;
  hidden = (
    await p.create({
      collection: "events",
      overrideAccess: false,
      user: admin,
      context: { manageSignupForm: true },
      data: {
        title: "报名草稿",
        slug: "signup-draft-" + stamp,
        _status: "draft",
        signupForm: form,
      },
    })
  ).id;
  post = (
    await p.create({
      collection: "community-posts",
      overrideAccess: false,
      user: manager,
      context: { manageSignupForm: true },
      data: {
        title: "项目报名",
        body: "测试",
        game,
        author: manager.id,
        category: "event",
        signupForm: form,
      },
    })
  ).id;
});
afterAll(async () => {
  if (!p) return;
  for (const u of [admin, member, other, manager])
    if (u)
      await p.delete({
        collection: "event-signups",
        overrideAccess: true,
        where: { member: { equals: u.id } },
      });
  if (post)
    await p.delete({
      collection: "community-posts",
      id: post,
      overrideAccess: true,
    });
  for (const id of [event, hidden])
    if (id) await p.delete({ collection: "events", id, overrideAccess: true });
  if (game)
    await p.delete({ collection: "games", id: game, overrideAccess: true });
  for (const u of [admin, member, other, manager])
    if (u)
      await p.delete({
        collection: "users",
        id: u.id,
        overrideAccess: true,
        context: { system: true },
      });
  await p.destroy();
});
it("validates forms, required answers, options, limits and stale versions", async () => {
  expect(() =>
    normalizeSignup({
      ...form,
      questions: [...form.questions, form.questions[0]],
    }),
  ).toThrow();
  expect(() => validateAnswers(form, { ...answers, name: "" })).toThrow();
  expect(() =>
    validateAnswers(form, { ...answers, slots: ["unknown"] }),
  ).toThrow();
  await expect(
    submitSignup(p, "events", event, member, "stale", answers),
  ).rejects.toThrow("更新");
  await expect(
    submitSignup(p, "events", hidden, member, formVersion(form), answers),
  ).rejects.toThrow();
  await expect(
    submitSignup(p, "events", event, null, formVersion(form), answers),
  ).rejects.toThrow("登录");
});
it("confirms once under concurrency and protects answers from other members", async () => {
  const v = await activity(p, "events", event, member);
  const [a, b] = await Promise.all([
    submitSignup(p, "events", event, member, v.version, answers),
    submitSignup(p, "events", event, member, v.version, answers),
  ]);
  expect(a.id).toBe(b.id);
  expect(
    (
      await p.find({
        collection: "event-signups",
        overrideAccess: false,
        user: other,
        where: { activityID: { equals: event } },
      })
    ).docs,
  ).toHaveLength(0);
  await expect(
    p.find({ collection: "event-signups", overrideAccess: false, user: null }),
  ).rejects.toThrow();
  await expect(
    p.update({
      collection: "event-signups",
      id: a.id,
      overrideAccess: false,
      user: member,
      data: { answers: { name: "changed" } },
    }),
  ).rejects.toThrow();
  expect(
    (
      await p.findByID({
        collection: "event-signups",
        id: a.id,
        overrideAccess: false,
        user: member,
      })
    ).answers,
  ).toEqual(answers);
});
it("enforces owner permissions, closed windows and preserves answer snapshots", async () => {
  const old = await activity(p, "events", event, admin, true);
  await expect(
    saveSignupForm(p, "events", event, member, old.version, form),
  ).rejects.toThrow("无权");
  const updated = await saveSignupForm(p, "events", event, admin, old.version, {
    ...form,
    closed: true,
    questions: form.questions.map((q) => ({ ...q, label: q.label + "新" })),
  });
  await expect(
    submitSignup(p, "events", event, other, updated.version, answers),
  ).rejects.toThrow("关闭");
  const receipt = await submitSignup(
    p,
    "events",
    event,
    member,
    old.version,
    answers,
  );
  expect(
    (receipt.questions as unknown as SignupForm["questions"])[0].label,
  ).toBe("称呼");
  await expect(
    saveSignupForm(p, "events", event, admin, old.version, form),
  ).rejects.toThrow("更新");
  const past = await saveSignupForm(
    p,
    "events",
    event,
    admin,
    updated.version,
    { ...form, end: "2020-01-01T00:00:00Z" },
  );
  await expect(
    submitSignup(p, "events", event, other, past.version, answers),
  ).rejects.toThrow("截止");
});
it("supports scoped community management and draft-only edits by community authors", async () => {
  const own = await activity(p, "community-posts", post, manager, true);
  await submitSignup(p, "community-posts", post, member, own.version, answers);
  expect(
    (
      await p.find({
        collection: "event-signups",
        overrideAccess: false,
        user: manager,
        where: { activityType: { equals: "community-posts" } },
      })
    ).docs,
  ).toHaveLength(1);
  await expect(activity(p, "events", event, manager, true)).rejects.toThrow(
    "无权",
  );
  const draft = await p.create({
    collection: "events",
    overrideAccess: false,
    user: manager,
    data: { title: "编辑问卷草稿", slug: "editor-form-" + stamp },
  });
  try {
    const config = await activity(p, "events", draft.id, manager, true);
    expect(
      (
        await saveSignupForm(
          p,
          "events",
          draft.id,
          manager,
          config.version,
          form,
        )
      ).draft,
    ).toBe(true);
    await expect(activity(p, "events", draft.id, member)).rejects.toThrow();
  } finally {
    await p.delete({
      collection: "events",
      id: draft.id,
      overrideAccess: true,
    });
  }
});
