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

async function drain(collection: import("../src/lib/content-translation/segments").TranslatableCollection, id: number, rounds = 30, translate?: Translator) {
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

describe("public content sources (news, pages, communities, showcase)", () => {
  it("publishing news, a community and an about page queues allowlisted text and serves English", async () => {
    const game = await p.create({ collection: "games", overrideAccess: false, user: president,
      data: { title: "合成社群乙", slug: `bilingual-game-b-${stamp}`, summary: "合成社群简介", _status: "published" } as never });
    const news = await p.create({ collection: "news", overrideAccess: false, user: president,
      data: { title: "合成新闻", slug: `bilingual-news-${stamp}`, summary: "合成新闻摘要", _status: "published" } as never });
    const about = await p.create({ collection: "pages", overrideAccess: false, user: president,
      data: { title: "关于合成", slug: `bilingual-about-${stamp}`, key: "about", sections: [{ heading: "合成问题", text: "合成回答" }], _status: "published" } as never });
    const privacy = await p.create({ collection: "pages", overrideAccess: false, user: president,
      data: { title: "合成隐私说明", slug: `bilingual-privacy-${stamp}`, key: "privacy", summary: "合成法律条款", _status: "published" } as never });
    for (const [collection, id] of [["games", game.id], ["news", news.id], ["pages", about.id]] as const)
      expect((await drain(collection, id as number))?.status).toBe("done");
    // The privacy notice is never sent: its row is closed without a provider call.
    expect(["obsolete", undefined]).toContain((await drain("pages", privacy.id as number))?.status);
    expect(sent()).toEqual(expect.arrayContaining(["合成社群乙", "合成社群简介", "合成新闻", "合成新闻摘要", "关于合成", "合成问题", "合成回答"]));
    expect(sent()).not.toContain("合成隐私说明");
    expect(sent()).not.toContain("合成法律条款");
    const page = await (await v2("pages/about", "en")).json();
    expect(page).toMatchObject({ key: "about", title: english("关于合成"), sections: [{ heading: english("合成问题"), text: english("合成回答") }] });
    expect((await (await v2("pages/privacy", "en")).json()).title).toBe("合成隐私说明");
    const article = await (await v2(`articles/news/${(news as { slug: string }).slug}`, "en", memberToken)).json();
    expect(article.article).toMatchObject({ title: english("合成新闻"), summary: english("合成新闻摘要") });
    const communities = await (await v2("communities", "en", memberToken)).json();
    const card = communities.docs.find((item: { community: { id: number } }) => item.community.id === game.id);
    expect(card).toMatchObject({ community: { title: english("合成社群乙"), slug: `bilingual-game-b-${stamp}` }, summary: english("合成社群简介") });
    // Mini program: its REST list keeps ids; the V2 feed it overlays from has the same ids in English.
    const feed = await (await v2("feed?kind=news&limit=50", "en", memberToken)).json();
    const newsCard = feed.docs.find((entry: { kind: string; item: { ref: { id: number } } }) => entry.kind === "article" && entry.item.ref.id === news.id);
    expect(newsCard.item).toMatchObject({ title: english("合成新闻"), summary: english("合成新闻摘要") });
    const rest = await p.find({ collection: "news", overrideAccess: false, user: member, depth: 0, where: { id: { equals: news.id } } });
    expect(rest.docs[0].title).toBe("合成新闻");
    // Chinese readers and identifiers are unchanged.
    expect((await (await v2("pages/about")).json()).title).toBe("关于合成");
  });

  it("showcase sends only title and body of visible posts; drafts and pending posts never", async () => {
    const game = await p.create({ collection: "games", overrideAccess: false, user: president,
      data: { title: "合成社群丙", slug: `bilingual-game-c-${stamp}`, _status: "published" } as never });
    const { default: sharp } = await import("sharp");
    const png = "data:image/png;base64," + (await sharp({ create: { width: 16, height: 16, channels: 3, background: "#777777" } }).png().toBuffer()).toString("base64");
    const visible = await p.create({ collection: "community-showcase", overrideAccess: false, user: president, context: { webShowcaseWrite: true },
      data: { title: "合成风采", body: "合成风采正文", game: game.id, images: [{ source: png, caption: "合成配图说明" }] } as never });
    const row = await drain("community-showcase", visible.id as number);
    expect(row?.status).toBe("done");
    expect(sent()).toEqual(expect.arrayContaining(["合成风采", "合成风采正文"]));
    expect(sent().join("|")).not.toMatch(/合成配图说明|data:image|合成president/);
    const draft = await p.create({ collection: "news", overrideAccess: false, user: president,
      data: { title: "合成新闻草稿", slug: `bilingual-news-draft-${stamp}` } as never, draft: true });
    expect(await store.readQueueRow("news", draft.id as number)).toBeNull();
  });
});

describe("bounded history backfill", () => {
  it("dry-run reports without writing or calling; cursor pages; real run is idempotent and reuses cache", async () => {
    const ids: number[] = [];
    for (let i = 0; i < 3; i++)
      ids.push(((await p.create({ collection: "news", overrideAccess: false, user: president, context: { skipTranslation: true },
        data: { title: `合成历史新闻${i}`, slug: `bilingual-history-${stamp}-${i}`, _status: "published" } as never })).id) as number);
    const draft = (await p.create({ collection: "news", overrideAccess: false, user: president, context: { skipTranslation: true },
      data: { title: "合成历史草稿", slug: `bilingual-history-draft-${stamp}` } as never, draft: true })).id as number;
    const rowsBefore = (await p.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM content_translations`)).rows[0];
    // Dry-run, also without a key.
    vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "");
    let report = await store.backfill(p, { collections: ["news"], limit: 2, pageSize: 1 });
    vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", fakeKey);
    expect(report.dryRun).toBe(true);
    expect(report.examined).toBe(2);
    expect(report.next?.collection).toBe("news");
    expect((await p.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM content_translations`)).rows[0]).toEqual(rowsBefore);
    expect(calls).toHaveLength(0);
    // Resume from the cursor until done: all three history items found, the draft is never eligible.
    const seen: number[] = [];
    let cursor = null as typeof report.next;
    do {
      report = await store.backfill(p, { collections: ["news"], limit: 2, pageSize: 2, after: cursor });
      seen.push(report.wouldQueue);
      cursor = report.next;
    } while (cursor);
    expect(seen.reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(3);
    expect(await store.readQueueRow("news", draft)).toBeNull();
    // A real run queues; running again queues nothing new.
    const first = await store.backfill(p, { dryRun: false, collections: ["news"], limit: 1000 });
    expect(first.queued).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect((await store.readQueueRow("news", id))?.status).toBe("pending");
    expect(await store.readQueueRow("news", draft)).toBeNull();
    const again = await store.backfill(p, { dryRun: false, collections: ["news"], limit: 1000 });
    expect(again.queued).toBe(0);
    expect(again.alreadyQueued).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect((await drain("news", id))?.status).toBe("done");
    const settled = await store.backfill(p, { collections: ["news"], limit: 1000 });
    expect(settled.wouldQueue).toBe(0);
    expect(settled.reusedSegments).toBeGreaterThanOrEqual(3);
    expect(settled.estimatedCalls).toBe(0);
    // A real run requires the key.
    vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "");
    await expect(store.backfill(p, { dryRun: false })).rejects.toBeTruthy();
    vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", fakeKey);
  });
});

describe("team honors use the honor wall's public projection", () => {
  it("translates only publicly eligible approved honors and applies English to the real projection", async () => {
    const { seedHonorCoreChain } = await import("./team-honor-core-fixtures");
    const { teamHonorService } = await import("../src/lib/team-honor-service");
    const { default: sharp } = await import("sharp");
    const actor = async (label: string, roles: User["roles"]) => p.create({ collection: "users", overrideAccess: true, context: { system: true },
      data: { name: `${label}-${stamp}`, email: `${label}-${stamp}@mails.tsinghua.edu.cn`, password, roles, affiliation: "tsinghua" } as never }) as Promise<User>;
    const leader = await actor("honor-leader", ["president"]);
    let reviewer = await actor("honor-reviewer", ["member"]);
    const player = await actor("honor-player", ["member"]);
    const game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true, skipTranslation: true },
      data: { title: "合成荣誉社群", slug: `bilingual-honor-game-${stamp}`, _status: "published" } as never })).id as number;
    reviewer = await p.update({ collection: "users", id: reviewer.id, overrideAccess: false, user: leader,
      data: { communityOffices: [{ game, status: "active", handleJoins: true, reviewShowcase: true }] } as never }) as User;
    const chain = await seedHonorCoreChain(p, game, reviewer, [player, reviewer], `bilingual-${stamp}`);
    const picture = "data:image/png;base64," + (await sharp({ create: { width: 20, height: 20, channels: 3, background: "purple" } }).png().toBuffer()).toString("base64");
    const submit = async (title: string) => teamHonorService.change(p, player, "submit", { input: { team: chain.team.id, title, competition: "合成联赛",
      placing: "合成冠军", date: "2026-10-01", description: "合成荣誉说明", images: [{ source: picture, caption: "合成证据说明" }] } });
    const approve = async (record: { id: number; revision: number; submittedVersion?: string | null }) =>
      teamHonorService.change(p, reviewer, "approve", { id: record.id, revision: record.revision, submittedVersion: record.submittedVersion });

    // Pending: queued marker may exist only after approval; nothing is sent before.
    const pending = await submit("合成待审荣誉");
    await store.processTranslationQueue({ payload: p });
    expect(sent()).not.toContain("合成待审荣誉");
    const approved = await approve(pending as never);
    expect((approved as { state: string }).state).toBe("approved");
    expect((await drain("team-honor-records", approved.id as number))?.status).toBe("done");
    expect(sent()).toEqual(expect.arrayContaining(["合成待审荣誉", "合成联赛", "合成冠军", "合成荣誉说明"]));
    // The honor's own request contains exactly its four allowlisted fields (the public team
    // name is translated separately as a published team, which is allowed).
    const honorBatch = calls.find((batch) => Object.values(batch).includes("合成待审荣誉"))!;
    expect(Object.values(honorBatch).sort()).toEqual(["合成冠军", "合成待审荣誉", "合成联赛", "合成荣誉说明"].sort());
    expect(sent().join("|")).not.toMatch(/合成证据说明|data:image|honor-player|honor-reviewer|合成确认|合成测试确认/);

    // English reaches the real honor projection (key "team-honor-records:<id>").
    const zh = await (await v2(`honors?team=${chain.team.id}`, undefined, memberToken)).json();
    const card = JSON.stringify(zh).includes(`team-honor-records:${approved.id}`);
    expect(card).toBe(true);
    const en = await (await v2(`honors?team=${chain.team.id}`, "en", memberToken)).json();
    const item = en.docs.find((value: Record<string, unknown>) => value.key === `team-honor-records:${approved.id}`);
    expect(item.team.id).toBe(chain.team.id); // identifiers unchanged
    // Mini program honor archive route: same English for the same record, Chinese without the header.
    const { GET: archiveRoute } = await import("../src/app/(frontend)/api/team-honor-archives/[team]/route");
    const archive = (locale?: string) => archiveRoute(new Request(`http://localhost:3000/api/team-honor-archives/${chain.team.id}`, { headers: locale ? { "x-zijing-locale": locale } : {} }),
      { params: Promise.resolve({ team: String(chain.team.id) }) });
    const archiveEn = await (await archive("en")).json();
    expect(archiveEn.records.find((record: { key: string }) => record.key === `team-honor-records:${approved.id}`)).toMatchObject({ title: english("合成待审荣誉"), placing: english("合成冠军") });
    const archiveZh = await (await archive()).json();
    expect(archiveZh.records.find((record: { key: string }) => record.key === `team-honor-records:${approved.id}`).title).toBe("合成待审荣誉");
    expect(item).toMatchObject({ title: english("合成待审荣誉"), competition: english("合成联赛"), placing: english("合成冠军"), description: english("合成荣誉说明") });

    // Team no longer public: an approved honor of that team is not sent (worker and backfill).
    // (Direct column change: the synthetic team leaves the public wall without other side effects.)
    await p.db.drizzle.execute(sql`UPDATE teams SET archived = true WHERE id = ${chain.team.id}`);
    calls = [];
    await store.markTranslation(p.db.drizzle as never, "team-honor-records", approved.id as number);
    expect((await drain("team-honor-records", approved.id as number))?.status).toBe("obsolete");
    expect(calls).toHaveLength(0);
    const report = await store.backfill(p, { collections: ["team-honor-records"], limit: 1000 });
    expect(report.wouldQueue).toBe(0);
    expect(report.notPublic).toBeGreaterThanOrEqual(1);
  });
});

describe("backfill estimate matches the worker's batching", () => {
  it("counts one call per sequential batch, e.g. three 2,500-character segments need three calls", () => {
    const segment = (n: number, length: number) => String(n) + "合".repeat(length - 1);
    expect(store.plannedCalls([segment(1, 2500), segment(2, 2500), segment(3, 2500)])).toBe(3);
    expect(store.plannedCalls([segment(1, 6000)])).toBe(1);
    expect(store.plannedCalls(Array.from({ length: 41 }, (_, i) => segment(i, 10)))).toBe(2);
    expect(store.plannedCalls([])).toBe(0);
  });
});

describe("remaining public sources (legacy honors, recruitment batches, site texts)", () => {
  it("verified legacy honors use the honor wall projection; unverified ones are never sent", async () => {
    const { seedHonorCoreChain } = await import("./team-honor-core-fixtures");
    const game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true, skipTranslation: true },
      data: { title: "合成旧荣誉社群", slug: `bilingual-legacy-game-${stamp}`, _status: "published" } as never })).id as number;
    const chain = await seedHonorCoreChain(p, game, president, [member], `legacy-${stamp}`);
    const legacy = async (title: string, verified: boolean) => (await p.create({ collection: "honors", overrideAccess: true, context: { system: true },
      data: { title, slug: `bilingual-legacy-${stamp}-${randomBytes(3).toString("hex")}`, team: chain.team.id, game, competition: "合成旧赛事", placing: "合成旧名次",
        summary: "合成旧说明", sourceURL: "https://example.invalid/proof", verified, _status: "published" } as never })).id as number;
    const verified = await legacy("合成已核验旧荣誉", true);
    const unverified = await legacy("合成未核验旧荣誉", false);
    expect((await drain("honors", verified))?.status).toBe("done");
    expect(await store.readQueueRow("honors", unverified)).toBeNull();
    const batch = calls.find((entry) => Object.values(entry).includes("合成已核验旧荣誉"))!;
    expect(Object.values(batch).sort()).toEqual(["合成已核验旧荣誉", "合成旧赛事", "合成旧名次", "合成旧说明"].sort());
    expect(sent().join("|")).not.toMatch(/合成未核验旧荣誉|example\.invalid/);
    // Web honor cards and the mini program archive show English for "honors:<id>"; key and source link unchanged.
    const en = await (await v2(`honors?team=${chain.team.id}`, "en", memberToken)).json();
    expect(en.docs.find((card: { key: string }) => card.key === `honors:${verified}`)).toMatchObject({ title: english("合成已核验旧荣誉"), description: english("合成旧说明") });
    const { GET: archiveRoute } = await import("../src/app/(frontend)/api/team-honor-archives/[team]/route");
    const archive = await (await archiveRoute(new Request(`http://localhost:3000/api/team-honor-archives/${chain.team.id}`, { headers: { "x-zijing-locale": "en" } }),
      { params: Promise.resolve({ team: String(chain.team.id) }) })).json();
    const record = archive.records.find((item: { key: string }) => item.key === `honors:${verified}`);
    expect(record).toMatchObject({ title: english("合成已核验旧荣誉"), competition: english("合成旧赛事"), legacy: true });
    expect(record.sourceHref).toMatch(/^\/honors\//);
    // Unverifying withdraws the English (no provider call).
    calls = [];
    await p.update({ collection: "honors", id: verified, overrideAccess: true, context: { system: true }, data: { verified: false } as never });
    expect((await drain("honors", verified))?.status).toBe("obsolete");
    expect(calls).toHaveLength(0);
  });

  it("staff batches send only title and description of open/closed batches; drafts never", async () => {
    const { saveStaffBatch } = await import("../src/lib/staff-recruitment");
    const { defaultStaffForm } = await import("../src/lib/staff-recruitment-model");
    const draft = await saveStaffBatch(p, president, null, null, { title: "合成草稿批次", description: "合成草稿说明", state: "draft", signupForm: defaultStaffForm }) as { id: number };
    expect(await store.readQueueRow("staff-batches", draft.id)).toBeNull();
    const open = await saveStaffBatch(p, president, draft.id, (await p.findByID({ collection: "staff-batches", id: draft.id, overrideAccess: true })).updatedAt,
      { title: "合成开放批次", description: "合成批次说明", state: "open", endAt: new Date(Date.now() + 7 * 86400000).toISOString(), signupForm: defaultStaffForm }) as { id: number };
    expect((await drain("staff-batches", open.id))?.status).toBe("done");
    const batch = calls.find((entry) => Object.values(entry).includes("合成开放批次"))!;
    expect(Object.values(batch).sort()).toEqual(["合成开放批次", "合成批次说明"].sort());
    expect(sent().join("|")).not.toMatch(/合成草稿|叶佳鑫|yejx/); // privacy text of the form is never sent
    const center = await (await v2("recruitment", "en", memberToken)).json();
    expect(JSON.stringify(center)).toContain(english("合成开放批次"));
  });

  it("team recruitment batches send the title and public form intro, never question labels or answers", async () => {
    const { seedHonorCoreChain } = await import("./team-honor-core-fixtures");
    const game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true, skipTranslation: true },
      data: { title: "合成选拔社群", slug: `bilingual-tryout-game-${stamp}`, _status: "published" } as never })).id as number;
    const chain = await seedHonorCoreChain(p, game, president, [member], `tryout-${stamp}`);
    const { defaultTeamForm } = await import("../src/lib/team-recruitment-form");
    const questionLabels = defaultTeamForm.questions.map((question) => question.label);
    await p.update({ collection: "team-recruitments", id: chain.recruitment.id, overrideAccess: true, user: president, context: { system: true, teamCoreWrite: true },
      data: { signupForm: { ...defaultTeamForm, intro: "合成选拔说明" } } as never });
    expect((await drain("team-recruitments", chain.recruitment.id as number))?.status).toBe("done");
    const batch = calls.find((entry) => Object.values(entry).includes("合成权威来源批次"))!;
    expect(Object.values(batch).sort()).toEqual(["合成权威来源批次", "合成选拔说明"].sort());
    expect(sent().join("|")).not.toMatch(/合成测试确认|合成权威成员来源/);
    for (const label of questionLabels) expect(Object.values(batch)).not.toContain(label);
    const center = await (await v2("recruitment", "en", memberToken)).json();
    expect(JSON.stringify(center)).toContain(english("合成权威来源批次"));
  });

  it("site settings: only public home texts are sent, versioned by content hash, applied to the home response", async () => {
    calls = [];
    await p.updateGlobal({ slug: "site", overrideAccess: true, context: { system: true },
      data: { heroTitle: "合成首屏标题", heroSubtitle: "合成首屏副标题", heroButtonLabel: "合成按钮", heroButtonURL: "/join", footer: "合成页脚",
        description: "合成站点描述", contacts: [{ label: "合成联系人", text: "合成微信号 synthetic-wechat" }] } as never });
    expect((await drain("site", 1))?.status).toBe("done");
    expect(sent()).toEqual(expect.arrayContaining(["合成首屏标题", "合成首屏副标题", "合成按钮", "合成页脚", "合成站点描述"]));
    expect(sent().join("|")).not.toMatch(/合成联系人|synthetic-wechat|\/join/);
    const home = await (await v2("home", "en")).json();
    expect(home.site).toMatchObject({ heroTitle: english("合成首屏标题"), heroSubtitle: english("合成首屏副标题"), footer: english("合成页脚") });
    expect(home.site.heroAction).toMatchObject({ label: english("合成按钮"), href: "/join" });
    expect((await (await v2("home")).json()).site.heroTitle).toBe("合成首屏标题");
    // A changed text is re-sent; unchanged texts reuse the cache; stale English is never shown.
    calls = [];
    await p.updateGlobal({ slug: "site", overrideAccess: true, context: { system: true }, data: { heroTitle: "合成新首屏标题" } as never });
    expect((await (await v2("home", "en")).json()).site.heroTitle).toBe("合成新首屏标题");
    await drain("site", 1);
    expect(sent()).toEqual(["合成新首屏标题"]);
    const report = await store.backfill(p, { collections: ["site"], limit: 10 });
    expect(report).toMatchObject({ examined: 1, wouldQueue: 0 });
  });

  it("a temporary failure inside the honor projection is retried, not marked obsolete", async () => {
    const { teamHonorService } = await import("../src/lib/team-honor-service");
    const row = (await p.find({ collection: "team-honor-records", overrideAccess: true, depth: 0, limit: 1, where: { state: { equals: "approved" } } })).docs[0];
    if (!row) throw new Error("expected an approved synthetic honor from the previous suite");
    // Make the record eligible again for this check (the earlier test archived its team).
    await p.db.drizzle.execute(sql`UPDATE teams SET archived = false WHERE id = ${Number(row.team)}`);
    const spy = vi.spyOn(teamHonorService, "publicRecord").mockResolvedValue(null); // what a swallowed DB error looks like
    try {
      await store.markTranslation(p.db.drizzle as never, "team-honor-records", row.id as number);
      await p.db.drizzle.execute(sql`UPDATE content_translations SET next_attempt_at = now() WHERE collection = 'team-honor-records' AND doc_id = ${row.id}`);
      await store.processTranslationQueue({ payload: p });
      const queued = await store.readQueueRow("team-honor-records", row.id as number);
      expect(queued?.status).toBe("pending");
      expect(queued?.error_code).toBe("read");
    } finally {
      spy.mockRestore();
    }
    // With the projection available again the job completes.
    expect((await drain("team-honor-records", row.id as number))?.status).toBe("done");
  });
});
