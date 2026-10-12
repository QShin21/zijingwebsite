import "dotenv/config";
import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
let p: Payload, leader: User, reader: User, member: User, backbone: User, a: number, b: number;
const events: number[] = [], suffix = randomBytes(6).toString("hex"), password = randomBytes(24).toString("hex");
const origin = { Origin: "http://localhost:3000" };
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "signup-authority-browser" });
  const create = (label: string, roles: User["roles"]) => p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: `${label}-${suffix}`, email: `${label}-${suffix}@example.invalid`, password, roles } });
  leader = await create("AuthorityLeader", ["president"]); reader = await create("AuthorityReader", ["member"]); member = await create("AuthorityMember", ["member"]); backbone = await create("AuthorityBackbone", ["backbone"]);
  const game = (label: string) => p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: `合成授权社群${label}`, slug: `authority-${label}-${suffix}`, _status: "published" } });
  a = (await game("a")).id; b = (await game("b")).id;
  reader = await p.update({ collection: "users", id: reader.id, user: leader, overrideAccess: false, data: { communityOffices: [{ game: a, status: "active", publishContent: false, reviewShowcase: false, handleJoins: false, viewSignups: true, exportSignups: true }] } });
});
test.afterAll(async () => {
  if (!p) return;
  if (events.length) { await p.delete({ collection: "event-signups", overrideAccess: true, where: { activityID: { in: events } } }); await p.delete({ collection: "events", overrideAccess: true, where: { id: { in: events } } }); }
  for (const actor of [leader, reader, member, backbone]) if (actor) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } });
  for (const id of [a, b]) if (id) await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});
async function login(page: Page, actor: User) {
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(actor.name); await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "登录", exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
}
for (const linked of [true, false]) test(`站点活动${linked ? "A" : "NULL"}→B：旧范围拒绝列表/单条/导出，本人回执及骨干边界保留`, async ({ page, browser }) => {
  const event = await p.create({ collection: "events", user: leader, overrideAccess: false, context: { system: true }, data: { title: "合成当前范围授权活动", slug: `scope-${linked}-${suffix}`, submittedBy: reader.id, game: linked ? a : null, _status: "published", signupForm: { enabled: true, questions: [{ id: "name", label: "合成称呼", type: "text", required: true }] } } });
  events.push(event.id); const endpoint = `/api/activities/events/${event.id}/signup`;
  const memberContext = await browser.newContext(), boneContext = await browser.newContext();
  try {
    const memberPage = await memberContext.newPage(); await login(memberPage, member);
    const initial = await memberPage.request.get(endpoint, { headers: origin }); expect(initial.status()).toBe(200); const info = await initial.json();
    const response = await memberPage.request.post(endpoint, { headers: origin, data: { version: info.version, answers: { name: "他人的合成答案" } } }); expect(response.status()).toBe(200); const foreign = (await response.json()).signup;
    await login(page, reader);
    const ownResponse = await page.request.post(endpoint, { headers: origin, data: { version: info.version, answers: { name: "本人的合成答案" } } }); expect(ownResponse.status()).toBe(200); const own = (await ownResponse.json()).signup;
    expect((await page.request.get(`/api/event-signups/${foreign.id}`, { headers: origin })).status()).toBe(200);
    expect((await page.request.get(endpoint + "?mode=export", { headers: origin })).status()).toBe(200);
    await p.update({ collection: "events", id: event.id, user: leader, overrideAccess: false, data: { game: b } });
    for (const mode of ["view", "entries", "stats", "export"]) expect((await page.request.get(endpoint + "?mode=" + mode, { headers: origin })).status()).toBe(403);
    const list = await page.request.get(`/api/event-signups?where[activityType][equals]=events&where[activityID][equals]=${event.id}`, { headers: origin }); expect(list.status()).toBe(200); expect((await list.json()).docs.map((row: { id: number }) => row.id)).toEqual([own.id]);
    expect((await page.request.get(`/api/event-signups/${foreign.id}`, { headers: origin })).status()).toBe(404);
    expect((await page.request.get(`/api/event-signups/${own.id}`, { headers: origin })).status()).toBe(200);
    expect((await memberPage.request.get(`/api/event-signups/${foreign.id}`, { headers: origin })).status()).toBe(200);
    const bonePage = await boneContext.newPage(); await login(bonePage, backbone);
    expect((await bonePage.request.get(`/api/event-signups/${foreign.id}`, { headers: origin })).status()).toBe(404);
    expect((await bonePage.request.get(endpoint + "?mode=export", { headers: origin })).status()).toBe(403);
    const offices = (await p.findByID({ collection: "users", id: reader.id, overrideAccess: true, depth: 0 })).communityOffices!;
    const isB = (office: typeof offices[number]) => Number(typeof office.game === "object" ? office.game?.id : office.game) === b;
    const grant = { game: b, status: "active" as const, publishContent: false, reviewShowcase: false, handleJoins: false, viewSignups: true, exportSignups: false };
    await p.update({ collection: "users", id: reader.id, user: leader, overrideAccess: false, data: { communityOffices: offices.some(isB) ? offices.map(office => isB(office) ? { ...office, ...grant } : office) : [...offices, grant] } });
    expect((await page.request.get(`/api/event-signups/${foreign.id}`, { headers: origin })).status()).toBe(200);
    expect((await page.request.get(endpoint + "?mode=view", { headers: origin })).status()).toBe(200);
    expect((await page.request.get(endpoint + "?mode=export", { headers: origin })).status()).toBe(403);
    const restored = await page.request.get(`/api/event-signups?where[activityType][equals]=events&where[activityID][equals]=${event.id}`, { headers: origin });
    expect(new Set((await restored.json()).docs.map((row: { id: number }) => row.id))).toEqual(new Set([own.id, foreign.id]));
    // Restore the shared reader's A-only scope for the next case.
    reader = await p.update({ collection: "users", id: reader.id, user: leader, overrideAccess: false, data: { communityOffices: (await p.findByID({ collection: "users", id: reader.id, overrideAccess: true, depth: 0 })).communityOffices!.filter(office => Number(typeof office.game === "object" ? office.game?.id : office.game) !== b) } });
  } finally { await memberContext.close(); await boneContext.close(); }
});
