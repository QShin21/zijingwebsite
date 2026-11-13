import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { createLocalReq, getPayload, type Payload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { up as migrateTranslations } from "../src/migrations/20261113_000900_content_translations";
import { v2Request } from "../src/lib/v2/http";
import { GET as readSignup, POST as writeSignup } from "../src/app/(frontend)/api/activities/[kind]/[id]/signup/route";
import type { Translator } from "../src/lib/content-translation/translator";

/*
 * Bilingual publishing against an isolated synthetic PostgreSQL. Run only through
 * scripts/verify-bilingual-database.mjs (embedded PostgreSQL, synthetic data, no .env).
 * The AI provider is a fake behind a stubbed fetch: no network, no paid calls, no real key.
 */
vi.mock("../src/lib/content", async () => {
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  return { cms: () => getPayload({ config }) };
});

const stamp = randomBytes(5).toString("hex");
const password = `synthetic-${randomBytes(12).toString("hex")}`;
const fakeKey = "synthetic-translation-key-not-real";
const english = (text: string) => "EN[" + Array.from(text).map((c) => c.codePointAt(0)!.toString(36)).join(".") + "]";
type Mode = "ok" | "fail" | "evil";
let mode: Mode = "ok";
let calls: Record<string, string>[] = [];
let p: Payload, president: User, member: User, memberToken: string;
let store: typeof import("../src/lib/content-translation/store");
const sent = () => calls.flatMap((batch) => Object.values(batch));

const form = {
  enabled: true, title: "合成报名表", intro: "合成说明", completionMessage: "合成完成提示",
  questions: [
    { id: "role", label: "参赛身份", type: "single", required: true, options: ["个人", "团队"], randomize: true },
    { id: "team", label: "队伍名称", type: "text", required: true, options: [], display: { mode: "all", rules: [{ questionId: "role", operator: "equals", value: "团队" }] } },
    { id: "pos", label: "位置", type: "select", required: false, options: ["上单", "打野"] },
  ],
};

function fakeProvider() {
  return vi.fn(async (url: string, init: RequestInit) => {
    if (!String(url).startsWith("https://llmapi.paratera.com/v1/")) throw new Error("unexpected host");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${fakeKey}`);
    const texts = JSON.parse(JSON.parse(String(init.body)).messages[1].content) as Record<string, string>;
    calls.push(texts);
    if (mode === "fail") return new Response("upstream down", { status: 503 });
    const out = Object.fromEntries(Object.entries(texts).map(([id, text]) => [id, mode === "evil" ? (id === "t0" ? "<script>alert(1)</script>" : text) : english(text)]));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(out) } }] }));
  });
}

async function createUser(name: string, roles: User["roles"]) {
  const email = `${name}-${stamp}@mails.tsinghua.edu.cn`;
  const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `合成${name}-${stamp}`, email, password, roles, affiliation: "tsinghua" } as never });
  const token = (await p.login({ collection: "users", data: { email, password } })).token!;
  return { user: user as User, token };
}

async function publishEvent(title: string, extra: Record<string, unknown> = {}, context: Record<string, unknown> = {}) {
  return (await p.create({ collection: "events", overrideAccess: false, user: president, context: { manageSignupForm: true, ...context },
    data: { title, slug: `bilingual-${stamp}-${randomBytes(3).toString("hex")}`, _status: "published", audience: "public",
      summary: "合成摘要", location: "合成场地", contact: "合成联系人 13800000000", signupForm: form, ...extra } as never })).id as number;
}
const slugOf = async (id: number) => String((await p.findByID({ collection: "events", id, overrideAccess: true, depth: 0 })).slug);

async function drain(collection: "events" | "community-posts" | "announcements", id: number, rounds = 30, translate?: Translator) {
  for (let i = 0; i < rounds; i++) {
    const row = await store.readQueueRow(collection, id);
    if (row && ["done", "failed", "obsolete"].includes(row.status)) return row;
    await p.db.drizzle.execute(sql`UPDATE content_translations SET next_attempt_at = now() WHERE status = 'pending'`);
    await store.processTranslationQueue({ payload: p, translate });
  }
  return store.readQueueRow(collection, id);
}

const v2 = (path: string, locale?: string, token?: string) => v2Request(p, new Request(`http://localhost:3000/api/v2/${path}`, {
  headers: { ...(locale ? { "x-zijing-locale": locale } : {}), ...(token ? { Authorization: `JWT ${token}` } : {}) },
}), path.split("?")[0].split("/"));

/** A translator that waits until released, to hold a lease open. */
function gate() {
  let release!: () => void;
  const opened = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const running = new Promise<void>((resolve) => { started = resolve; });
  const translate: Translator = async (texts) => {
    calls.push(texts);
    started();
    await opened;
    return Object.fromEntries(Object.entries(texts).map(([id, text]) => [id, english(text)]));
  };
  return { translate, release, running };
}

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || process.env.BILINGUAL_TEST !== "isolated" || db.hostname !== "127.0.0.1" || !db.pathname.startsWith("/bilingual_"))
    throw new Error("Bilingual integration tests require the isolated synthetic database");
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", fakeKey);
  vi.stubEnv("QUESTIONNAIRE_AI_BASE_URL", "");
  vi.stubEnv("CONTENT_TRANSLATION_WORKER", "off");
  vi.stubGlobal("fetch", fakeProvider());
  p = await getPayload({ config });
  store = await import("../src/lib/content-translation/store");
  president = (await createUser("president", ["vicePresident"])).user;
  const created = await createUser("member", ["member"]);
  member = created.user; memberToken = created.token;
});

beforeEach(async () => {
  mode = "ok";
  calls = [];
  await p.db.drizzle.execute(sql`DELETE FROM auth_rate_limits`);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await store?.closeTranslationPool();
});

describe("migration", () => {
  it("is additive and idempotent on a database with existing content", async () => {
    const before = await p.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM events`);
    await migrateTranslations({ db: p.db.drizzle, payload: p, req: {} } as never);
    const after = await p.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM events`);
    expect(after.rows[0]).toEqual(before.rows[0]);
    const columns = await p.db.drizzle.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'content_translations'`);
    expect(columns.rows.map((row) => row.column_name)).toEqual(expect.arrayContaining(["translations", "generation", "lease_token", "lease_until", "source_hash", "attempts"]));
    const applied = await p.db.drizzle.execute(sql`SELECT name FROM payload_migrations WHERE name IN ('20261113_000700_custom_seat_layout', '20261113_000900_content_translations')`);
    expect(applied.rows.map((row) => row.name).sort()).toEqual(["20261113_000700_custom_seat_layout", "20261113_000900_content_translations"]);
  });
});

describe("publish → translate → English display", () => {
  let event: number, slug: string;
  it("queues durably on publish and sends only published text", async () => {
    event = await publishEvent("合成双语活动");
    slug = await slugOf(event);
    expect((await store.readQueueRow("events", event))?.status).toBe("pending");
    expect(calls).toHaveLength(0); // nothing is sent from the publish request itself
    const row = await drain("events", event);
    expect(row?.status).toBe("done");
    expect(sent()).toEqual(expect.arrayContaining(["合成双语活动", "合成摘要", "合成场地", "参赛身份", "个人", "团队", "合成报名表"]));
    expect(sent().join("|")).not.toMatch(/13800000000|合成联系人|@|synthetic-/);
    expect(JSON.stringify(row)).not.toContain(fakeKey);
  });

  it("serves English only to English readers through the normal V2 read", async () => {
    const zh = await (await v2(`events/club/${slug}`)).json();
    const en = await (await v2(`events/club/${slug}`, "en")).json();
    expect(zh.event.title).toBe("合成双语活动");
    expect(en.event.title).toBe(english("合成双语活动"));
    expect(en.event.location).toBe(english("合成场地"));
    expect(en.event.ref).toEqual(zh.event.ref);
    expect(en.event.href).toBe(zh.event.href);
    expect(en.event.signup).toEqual(zh.event.signup);
    const calendar = await (await v2("calendar?scope=club", "en")).json();
    expect(calendar.docs.find((card: { ref: { id: number } }) => card.ref.id === event)?.title).toBe(english("合成双语活动"));
  });

  it("adds a display projection beside the unchanged questionnaire and stores Chinese values", async () => {
    const context = { params: Promise.resolve({ kind: "events", id: String(event) }) };
    const read = await (await readSignup(new Request(`http://localhost:3000/api/activities/events/${event}/signup`, {
      headers: { Authorization: `JWT ${memberToken}`, "x-zijing-locale": "en", "x-questionnaire-version": "3" } }), context)).json();
    expect(read.form.questions[0].options).toEqual(["个人", "团队"]);
    expect(read.form.questions[1].display.rules[0].value).toBe("团队");
    expect(read.display.questions.role.options).toEqual([["个人", english("个人")], ["团队", english("团队")]]);
    expect(read.display.title).toBe(english("合成报名表"));
    expect(read.title).toBe(english("合成双语活动"));
    const zhRead = await (await readSignup(new Request(`http://localhost:3000/api/activities/events/${event}/signup`, {
      headers: { Authorization: `JWT ${memberToken}`, "x-questionnaire-version": "3" } }), context)).json();
    expect(zhRead.display).toBeUndefined();
    expect(zhRead.form).toEqual(read.form);
    const response = await writeSignup(new Request(`http://localhost:3000/api/activities/events/${event}/signup`, {
      method: "POST", headers: { Authorization: `JWT ${memberToken}`, Origin: "http://localhost:3000", "Content-Type": "application/json", "x-zijing-locale": "en" },
      body: JSON.stringify({ version: read.version, answers: { role: "团队", team: "Zijing", pos: "打野" } }) }), context);
    expect(response.status).toBeLessThan(300);
    const saved = await p.find({ collection: "event-signups", overrideAccess: true, depth: 0, where: { member: { equals: member.id } } });
    expect(saved.docs[0].answers).toEqual({ role: "团队", team: "Zijing", pos: "打野" });
    expect(sent()).not.toContain("Zijing");
  });

  it("invalidates edited text and only resends what changed", async () => {
    await p.update({ collection: "events", id: event, overrideAccess: false, user: president, data: { title: "合成双语活动（改）", _status: "published" } as never });
    const pending = await (await v2(`events/club/${slug}`, "en")).json();
    expect(pending.event.title).toBe("合成双语活动（改）"); // stale English is never shown
    expect(pending.event.location).toBe(english("合成场地"));
    await drain("events", event);
    expect(sent()).toContain("合成双语活动（改）");
    expect(sent()).not.toContain("合成场地");
    expect((await (await v2(`events/club/${slug}`, "en")).json()).event.title).toBe(english("合成双语活动（改）"));
  });

  it("never translates a draft saved over a published event", async () => {
    await p.update({ collection: "events", id: event, overrideAccess: false, user: president, draft: true, data: { title: "合成草稿标题" } as never });
    await drain("events", event);
    expect(sent()).not.toContain("合成草稿标题");
  });
});

describe("stale and private work never reaches the provider", () => {
  it("rolled-back publishes leave no queue row", async () => {
    const transactionID = await p.db.beginTransaction();
    const req = await createLocalReq({ user: president, context: { manageSignupForm: true } }, p);
    req.transactionID = transactionID!;
    const doc = await p.create({ collection: "events", req, overrideAccess: false, user: president,
      data: { title: "合成回滚活动", slug: `rollback-${stamp}`, _status: "published", audience: "public" } as never });
    expect((await p.db.drizzle.execute(sql`SELECT 1 FROM content_translations WHERE doc_id = ${doc.id} AND collection = 'events'`)).rows).toHaveLength(0);
    await p.db.rollbackTransaction(transactionID!);
    expect(await store.readQueueRow("events", doc.id as number)).toBeNull();
    await store.processTranslationQueue({ payload: p });
    expect(sent()).not.toContain("合成回滚活动");
  });

  it("unpublishing before the worker runs cancels the job and clears English", async () => {
    const id = await publishEvent("合成撤稿活动");
    await p.update({ collection: "events", id, overrideAccess: false, user: president, data: { _status: "draft" } as never });
    const row = await drain("events", id);
    expect(row?.status).toBe("obsolete");
    expect(row?.translations).toEqual({});
    expect(sent()).not.toContain("合成撤稿活动");
  });

  it("hidden community posts become obsolete without a provider call", async () => {
    const game = await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: `合成社群${stamp}`, slug: `bilingual-game-${stamp}`, _status: "published" } as never });
    const post = await p.create({ collection: "community-posts", overrideAccess: true, user: president,
      data: { title: "合成社群通知", body: "合成通知正文", game: game.id, category: "notice", audience: "public" } as never });
    await drain("community-posts", post.id as number);
    expect(sent()).toContain("合成社群通知");
    calls = [];
    await p.update({ collection: "community-posts", id: post.id, overrideAccess: true, user: president, data: { status: "hidden", body: "合成隐藏后正文" } as never });
    const row = await drain("community-posts", post.id as number);
    expect(row?.status).toBe("obsolete");
    expect(sent()).toEqual([]);
  });

  it("deleting a document removes its row", async () => {
    const id = await publishEvent("合成删除活动");
    await p.delete({ collection: "events", id, overrideAccess: true });
    expect(await store.readQueueRow("events", id)).toBeNull();
  });
});

describe("leases, generations and concurrency", () => {
  it("an edit during processing bumps the generation without resetting the lease; the owner hands back to pending", async () => {
    const id = await publishEvent("合成租约活动");
    const held = gate();
    const worker = store.processTranslationQueue({ payload: p, translate: held.translate, maxJobs: 1 });
    await held.running;
    const before = await store.readQueueRow("events", id);
    expect(before?.status).toBe("processing");
    // A publish while the provider call is in flight, then two racing queue marks.
    await p.update({ collection: "events", id, overrideAccess: false, user: president, data: { title: "合成租约活动（新）", summary: "合成新摘要", _status: "published" } as never });
    await Promise.all([store.markTranslation(p.db.drizzle as never, "events", id), store.markTranslation(p.db.drizzle as never, "events", id)]);
    const during = await store.readQueueRow("events", id);
    expect(during?.status).toBe("processing");
    expect(during?.lease_token).toBe(before?.lease_token);
    expect(during!.generation).toBe(before!.generation + 3);
    held.release();
    await worker;
    const after = await store.readQueueRow("events", id);
    expect(after?.status).toBe("pending");
    await drain("events", id);
    expect(sent()).toContain("合成租约活动（新）");
    expect(sent()).toContain("合成新摘要");
    expect((await store.readQueueRow("events", id))?.status).toBe("done");
  });

  it("a worker whose lease expired cannot overwrite the new owner's result", async () => {
    const id = await publishEvent("合成过期租约活动");
    const slow = gate();
    const workerA = store.processTranslationQueue({ payload: p, translate: slow.translate, maxJobs: 1 });
    await slow.running;
    const tokenA = (await store.readQueueRow("events", id))?.lease_token;
    await p.db.drizzle.execute(sql`UPDATE content_translations SET lease_until = now() - interval '1 second' WHERE collection = 'events' AND doc_id = ${id}`);
    vi.resetModules();
    const other = await import("../src/lib/content-translation/store");
    const workerB: Translator = async (texts) => Object.fromEntries(Object.entries(texts).map(([key, text]) => [key, "B:" + english(text)]));
    for (let i = 0; i < 10; i++) {
      await other.processTranslationQueue({ payload: p, translate: workerB, maxJobs: 1 });
      const row = await other.readQueueRow("events", id);
      if (row?.status === "done") break;
    }
    const owned = await other.readQueueRow("events", id);
    expect(owned?.status).toBe("done");
    expect(owned?.lease_token).toBeNull();
    expect(tokenA).toBeTruthy();
    slow.release();
    await workerA;
    const final = await store.readQueueRow("events", id);
    expect(Object.values(final!.translations).every((value) => value.startsWith("B:"))).toBe(true);
    await other.closeTranslationPool();
  });

  it("parallel workers in separate processes never translate the same batch twice", async () => {
    const id = await publishEvent("合成并发活动");
    vi.resetModules();
    const other = await import("../src/lib/content-translation/store");
    const tracked: Translator = async (texts) => {
      calls.push(texts);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return Object.fromEntries(Object.entries(texts).map(([key, text]) => [key, english(text)]));
    };
    await Promise.all([store.processTranslationQueue({ payload: p, translate: tracked }), other.processTranslationQueue({ payload: p, translate: tracked })]);
    await drain("events", id, 30, tracked);
    expect(sent().filter((text) => text === "合成并发活动")).toHaveLength(1);
    await other.closeTranslationPool();
  });
});

describe("access, failure and limits", () => {
  it("does not widen audiences: a campus-only event stays hidden from anonymous English readers", async () => {
    const id = await publishEvent("合成校内活动", { audience: "campus" });
    expect((await drain("events", id))?.status).toBe("done");
    const slug = await slugOf(id);
    expect((await v2(`events/club/${slug}`, "en")).status).toBe(404);
    expect(JSON.stringify(await (await v2("calendar?scope=club", "en")).json())).not.toContain(english("合成校内活动"));
    expect((await v2(`events/club/${slug}`, "en", memberToken)).status).toBe(200);
  });

  it("falls back to Chinese when the provider fails, with bounded attempts", async () => {
    mode = "fail";
    const id = await publishEvent("合成失败活动");
    for (let i = 0; i < 5; i++) {
      await p.db.drizzle.execute(sql`UPDATE content_translations SET next_attempt_at = now() WHERE collection = 'events' AND doc_id = ${id}`);
      await store.processTranslationQueue({ payload: p });
    }
    const row = await store.readQueueRow("events", id);
    expect(row?.status).toBe("failed");
    expect(row?.error_code).toBe("http");
    expect(calls.filter((batch) => Object.values(batch).includes("合成失败活动"))).toHaveLength(3);
    expect((await (await v2(`events/club/${await slugOf(id)}`, "en")).json()).event.title).toBe("合成失败活动");
  });

  it("rejects malicious or untranslated output per text", async () => {
    mode = "evil";
    const id = await publishEvent("合成恶意输出活动");
    await drain("events", id, 4);
    const values = Object.values((await store.readQueueRow("events", id))?.translations ?? {});
    expect(values.some((value) => /[一-鿿]/.test(value))).toBe(false);
    if (values.length) expect(values).toContain("<script>alert(1)</script>");
    const slug = await slugOf(id);
    const response = await v2(`events/club/${slug}`, "en");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("stops at the hourly budget without consuming attempts", async () => {
    const id = await publishEvent("合成额度活动");
    const key = createHmac("sha256", process.env.PAYLOAD_SECRET || "missing").update("content-translation:site").digest("hex");
    for (let i = 0; i < 200 && (await store.readQueueRow("events", id))?.error_code !== "budget"; i++) {
      await p.db.drizzle.execute(sql`INSERT INTO auth_rate_limits (key, window_start, hits) VALUES (${key}, now(), 100000) ON CONFLICT (key) DO UPDATE SET hits = 100000, window_start = now()`);
      await store.processTranslationQueue({ payload: p, maxJobs: 1 });
    }
    const row = await store.readQueueRow("events", id);
    expect(row?.error_code).toBe("budget");
    expect(row?.status).toBe("pending");
    expect(row?.attempts).toBe(0);
    expect(sent()).not.toContain("合成额度活动");
  });

  it("is disabled without a key: no row, no call, Chinese shown", async () => {
    vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "");
    try {
      const id = await publishEvent("合成无密钥活动");
      expect(await store.readQueueRow("events", id)).toBeNull();
      await store.processTranslationQueue({ payload: p });
      expect(sent()).not.toContain("合成无密钥活动");
    } finally {
      vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", fakeKey);
    }
  });

  it("explicit backfill queues older published documents once", async () => {
    const id = await publishEvent("合成历史活动", {}, { skipTranslation: true });
    expect(await store.readQueueRow("events", id)).toBeNull();
    expect(await store.backfillPublished(p, 500)).toBeGreaterThan(0);
    expect((await store.readQueueRow("events", id))?.status).toBe("pending");
    expect(await store.backfillPublished(p, 500)).toBe(0);
    const row = await drain("events", id);
    expect(row?.status).toBe("done");
  });

  it("falls back to Chinese and keeps publishing when the table is missing", async () => {
    await p.db.drizzle.execute(sql`ALTER TABLE content_translations RENAME TO content_translations_hidden`);
    try {
      const id = await publishEvent("合成无表活动");
      expect(id).toBeGreaterThan(0);
      expect(JSON.stringify(await (await v2("calendar?scope=club", "en")).json())).toContain("合成无表活动");
    } finally {
      await p.db.drizzle.execute(sql`ALTER TABLE content_translations_hidden RENAME TO content_translations`);
    }
  });
});

describe("crash recovery and restart", () => {
  it("a worker that crashed after its last attempt leaves a failed row, not processing forever", async () => {
    const id = await publishEvent("合成崩溃活动");
    // Simulate: third claim taken, then the process died before writing back.
    await p.db.drizzle.execute(sql`UPDATE content_translations SET status = 'processing', attempts = 3, lease_token = 'dead-worker',
      lease_until = now() - interval '1 second' WHERE collection = 'events' AND doc_id = ${id}`);
    await store.processTranslationQueue({ payload: p });
    const row = await store.readQueueRow("events", id);
    expect(row?.status).toBe("failed");
    expect(row?.error_code).toBe("lease_expired");
    expect(row?.lease_token).toBeNull();
    expect(sent()).not.toContain("合成崩溃活动");
    // A later publish starts a fresh generation with fresh attempts.
    await p.update({ collection: "events", id, overrideAccess: false, user: president, data: { title: "合成崩溃活动（重发）", _status: "published" } as never });
    expect((await drain("events", id))?.status).toBe("done");
  });

  it("a live lease with attempts left is not expired early", async () => {
    const id = await publishEvent("合成租约未过期活动");
    await p.db.drizzle.execute(sql`UPDATE content_translations SET status = 'processing', attempts = 3, lease_token = 'live-worker',
      lease_until = now() + interval '2 minutes' WHERE collection = 'events' AND doc_id = ${id}`);
    expect(await store.expireExhaustedLeases()).toBe(0);
    expect((await store.readQueueRow("events", id))?.status).toBe("processing");
    await p.db.drizzle.execute(sql`UPDATE content_translations SET status = 'pending', attempts = 0, lease_token = NULL, lease_until = NULL WHERE collection = 'events' AND doc_id = ${id}`);
    await drain("events", id);
  });

  it("a temporary database read failure is retried, never treated as unpublish", async () => {
    const id = await publishEvent("合成读取故障活动");
    expect((await drain("events", id))?.status).toBe("done");
    const translated = (await store.readQueueRow("events", id))!.translations;
    await p.update({ collection: "events", id, overrideAccess: false, user: president, data: { summary: "合成读取故障摘要", _status: "published" } as never });
    calls = [];
    // The worker's read of this document fails like a dropped connection.
    const flaky = new Proxy(p, { get(target, key, receiver) {
      if (key === "findByID") return async (args: { id: number }) => {
        if (Number(args.id) === id) throw Object.assign(new Error("Connection terminated unexpectedly"), { code: "57P01" });
        return target.findByID(args as never);
      };
      return Reflect.get(target, key, receiver);
    } });
    await store.processTranslationQueue({ payload: flaky as Payload });
    const row = await store.readQueueRow("events", id);
    expect(row?.status).toBe("pending");
    expect(row?.error_code).toBe("read");
    expect(row?.translations).toEqual(translated); // existing English kept, not cleared
    expect(calls).toHaveLength(0);
    // Once the database is back the job completes with the new text.
    expect((await drain("events", id))?.status).toBe("done");
    expect(sent()).toContain("合成读取故障摘要");
    // Repeated read failures end as failed after the bounded attempts (still not obsolete).
    const before = (await store.readQueueRow("events", id))!.translations;
    await p.update({ collection: "events", id, overrideAccess: false, user: president, data: { summary: "合成读取故障摘要二", _status: "published" } as never });
    for (let i = 0; i < 5; i++) {
      await p.db.drizzle.execute(sql`UPDATE content_translations SET next_attempt_at = now() WHERE collection = 'events' AND doc_id = ${id}`);
      await store.processTranslationQueue({ payload: flaky as Payload });
    }
    const exhausted = await store.readQueueRow("events", id);
    expect(exhausted?.status).toBe("failed");
    expect(exhausted?.error_code).toBe("read");
    expect(exhausted?.translations).toEqual(before);
  });

  it("server start resumes pending work without any publish or English reader", async () => {
    const id = await publishEvent("合成重启恢复活动");
    expect((await store.readQueueRow("events", id))?.status).toBe("pending");
    // Disabled worker: the startup hook does nothing.
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const { register } = await import("../src/instrumentation");
    await register();
    expect(store.startTranslationSweep(0)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await store.readQueueRow("events", id))?.status).toBe("pending");
    // Enabled worker: register() starts the bounded sweep, which processes the queue.
    vi.stubEnv("CONTENT_TRANSLATION_WORKER", "");
    try {
      expect(store.startTranslationSweep(0)).toBe(true);
      let row = await store.readQueueRow("events", id);
      for (let i = 0; i < 100 && row?.status !== "done"; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        row = await store.readQueueRow("events", id);
      }
      expect(row?.status).toBe("done");
      expect(sent()).toContain("合成重启恢复活动");
    } finally {
      vi.stubEnv("CONTENT_TRANSLATION_WORKER", "off");
      await store.closeTranslationPool(); // stops the sweep timer; the pool reopens lazily
    }
  });
});
