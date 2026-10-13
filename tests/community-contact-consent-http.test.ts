import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import pg from "pg";
import { getPayload, type Payload } from "payload";
import { REST_POST } from "@payloadcms/next/routes";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import config from "../src/payload.config";
import type { CommunityApplication, User } from "../src/payload-types";
import { editCommunityApplication } from "../src/lib/community-operations";

const location = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: location.cms }));
// Registration is outside this adapter; JWT login/authentication remain real.
vi.mock("../src/app/(frontend)/account/actions", () => ({
  beginRegistrationAction: vi.fn(() => {
    throw new Error("Unrelated registration path not under test");
  }),
  registerAction: vi.fn(() => {
    throw new Error("Unrelated registration path not under test");
  }),
}));
import * as mini from "../src/app/(frontend)/api/miniapp/[...path]/route";

// Real loopback HTTP -> actual miniapp export or the same Payload REST builder
// used by the website API -> JWT, collection hooks, transactions and PostgreSQL.
// No Next proxy, WeChat SDK or production database is claimed by this adapter.
let p: Payload,
  server: Server | undefined,
  origin: string,
  sql: pg.Client,
  qr: string;
let owner: User, outsider: User, reviewer: User, localAdmin: User;
let game: number, otherGame: number;
const actors: User[] = [],
  tokens = new Map<number, string>();
const suffix = randomBytes(6).toString("hex");
const password = "Synthetic-Contact-Consent-Only-20261013!";
const error = "由于入社流程规定，必须展示管理联系方式";
const miniPath = "/api/miniapp/community/applications";
const rawPath = "/api/community-applications";
const rest = REST_POST(config);
const values = (extra: Record<string, unknown> = {}) => ({
  proposedGame: "合成待建社群" + randomBytes(4).toString("hex"),
  realName: "合成申请人",
  phone: "00000000000",
  reason: "合成社群管理员联系方式授权测试说明",
  wechatQr: qr,
  contactConsent: true,
  ...extra,
});
async function http(
  actor: User | null,
  data?: Record<string, unknown>,
  path = miniPath,
) {
  const response = await fetch(origin + path, {
    method: data ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      ...(actor ? { authorization: "JWT " + tokens.get(actor.id) } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}
async function submit(actor = owner, extra: Record<string, unknown> = {}) {
  const result = await http(actor, { action: "submit", ...values(extra) });
  expect(result.status).toBe(200);
  return result.body.application as CommunityApplication;
}
const read = (id: number) =>
  p.findByID({
    collection: "community-applications",
    id,
    overrideAccess: true,
    depth: 0,
  });
const action = (app: CommunityApplication, extra: Record<string, unknown>) => ({
  id: app.id,
  revision: app.updatedAt,
  ...extra,
});
async function legacy(app: CommunityApplication, contactConsent: false | null) {
  // Only the newly-created synthetic fixture is changed, after the guard below
  // proves this is a disposable DB. No migration/backfill is introduced.
  await sql.query(
    "UPDATE community_applications SET contact_consent = $1 WHERE id = $2",
    [contactConsent, app.id],
  );
  return read(app.id);
}

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  const delegated =
    db.hostname === "127.0.0.1" &&
    /^\d+$/.test(db.port) &&
    db.port === process.env.COMMUNITY_CONTACT_CONSENT_DB_PORT &&
    db.username === "consent_synthetic" &&
    db.pathname === "/community_contact_consent_qa_synthetic";
  const repositoryCI =
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_REPOSITORY === "QShin21/zijingwebsite" &&
    db.hostname === "127.0.0.1" &&
    db.port === "5432" &&
    db.username === "zijing" &&
    db.pathname === "/zijing";
  if (
    process.env.APP_ENV !== "development" ||
    process.env.DB_PUSH !== "false" ||
    !(delegated || repositoryCI)
  )
    throw new Error(
      "Only the delegated disposable synthetic DB or this repository's isolated CI DB is allowed",
    );
  const base = await config;
  base.typescript.autoGenerate = false;
  const init = base.db.init;
  base.db = {
    ...base.db,
    init: (args) => {
      const adapter = init(args) as PostgresAdapter;
      adapter.pool = new adapter.pg.Pool(adapter.poolOptions);
      return adapter;
    },
  };
  p = await getPayload({ config });
  p.logger.level = "fatal";
  location.cms.mockResolvedValue(p);
  sql = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  qr =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 40, height: 40, channels: 3, background: "white" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
  async function actor(label: string, roles: User["roles"]) {
    const user = await p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: label + suffix,
        email: label + suffix + "@example.invalid",
        password,
        roles,
      },
    });
    actors.push(user);
    const login = await p.login({
      collection: "users",
      data: { email: user.email, password },
    });
    if (!login.token) throw new Error("Synthetic JWT required");
    tokens.set(user.id, login.token);
    return user;
  }
  owner = await actor("consent-owner", ["member"]);
  outsider = await actor("consent-outsider", ["member"]);
  reviewer = await actor("consent-reviewer", ["vicePresident"]);
  localAdmin = await actor("consent-local-admin", ["communityAdmin"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成既有授权社群" + suffix,
        slug: "consent-scope-" + suffix,
        _status: "published",
      },
    })
  ).id;
  otherGame = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成另一社群" + suffix,
        slug: "consent-other-" + suffix,
        _status: "published",
      },
    })
  ).id;
  localAdmin = await p.update({
    collection: "users",
    id: localAdmin.id,
    overrideAccess: true,
    context: { system: true },
    data: {
      communityOffices: [
        {
          game: otherGame,
          status: "active",
          publishContent: true,
          reviewShowcase: true,
          handleJoins: true,
          contactConsent: false,
        },
      ],
    },
  });
  server = createServer((incoming, outgoing) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      Object.entries(incoming.headers).forEach(([key, value]) => {
        if (value !== undefined)
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      });
      const request = new Request(origin + incoming.url, {
        method: incoming.method,
        headers,
        ...(incoming.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
      });
      const response = incoming.url?.startsWith(rawPath)
        ? await rest(request, {
            params: Promise.resolve({ slug: ["community-applications"] }),
          })
        : incoming.method === "POST"
          ? await mini.POST(request, {
              params: Promise.resolve({ path: ["community", "applications"] }),
            })
          : await mini.GET(request, {
              params: Promise.resolve({ path: ["community", "applications"] }),
            });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    })().catch(() => {
      outgoing.writeHead(500, { "content-type": "application/json" });
      outgoing.end(
        JSON.stringify({ error: "Synthetic transport adapter failed" }),
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", resolve);
  });
  origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
}, 60000);
afterEach(async () => {
  if (!p) return;
  await p.delete({
    collection: "community-applications",
    overrideAccess: true,
    where: { applicant: { in: actors.map((user) => user.id) } },
  });
  for (const user of [owner, outsider])
    await p.update({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      context: { system: true },
      data: { communityOffices: [] },
    });
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((cause) => (cause ? reject(cause) : resolve())),
    );
  if (sql) await sql.end();
  if (!p) return;
  for (const user of actors)
    await p.delete({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      context: { system: true },
    });
  for (const id of [game, otherGame])
    if (id) await p.delete({ collection: "games", id, overrideAccess: true });
  const adapter = p.db as typeof p.db & {
    sessions: Record<string, unknown>;
    pool: { end(): Promise<void> };
  };
  for (const id of Object.keys(adapter.sessions))
    await adapter.rollbackTransaction(id);
  await adapter.pool.end();
  await p.destroy();
});

describe.each([miniPath, rawPath])("%s 的真实JWT/HTTP/SQL严格同意", (path) => {
  it.each(
    [undefined, false, null, "true", "false", 1, {}, []].map(
      (contactConsent) => ({ contactConsent }),
    ),
  )(
    "原始非true $contactConsent不能经Payload字符串转换或伪造身份提交",
    async ({ contactConsent }) => {
      const input = values({
        contactConsent,
        applicant: outsider.id,
        roles: ["president"],
        context: { system: true, applicationResolved: true },
      });
      const result = await http(owner, { ...input, action: "submit" }, path);
      expect(result.status).toBe(400);
      expect(JSON.stringify(result.body)).toContain(error);
      expect(
        (
          await p.count({
            collection: "community-applications",
            overrideAccess: true,
          })
        ).totalDocs,
      ).toBe(0);
    },
  );
  it("明确布尔true成功，未登录仍拒绝；源记录保留本人同意而不公开待审名片", async () => {
    const input = values({ game });
    const denied = await http(null, { ...input, action: "submit" }, path);
    expect([401, 403]).toContain(denied.status);
    const result = await http(owner, { ...input, action: "submit" }, path);
    expect([200, 201]).toContain(result.status);
    const saved = await read(
      path === miniPath ? result.body.application.id : result.body.doc.id,
    );
    expect(saved.contactConsent).toBe(true);
    expect(saved.applicant).toBe(owner.id);
    expect(saved.status).toBe("pending");
    expect(
      (
        await p.find({
          collection: "community-applications",
          overrideAccess: false,
          user: null,
          context: { publicCommunityContacts: game },
          where: { id: { equals: saved.id } },
        })
      ).docs,
    ).toEqual([]);
  });
});
describe("历史授权、本人补同意及原权限/version边界", () => {
  it.each([false, null] as const)(
    "历史%s不能由审核人伪造同意批准，退回本人明确补同意后才授权",
    async (consent) => {
      const app = await legacy(await submit(owner, { game }), consent);
      const officesBefore =
        (
          await p.findByID({
            collection: "users",
            id: owner.id,
            overrideAccess: true,
          })
        ).communityOffices || [];
      const denied = await http(
        reviewer,
        action(app, {
          action: "review",
          decision: "approved",
          contactConsent: true,
          context: { system: true },
        }),
      );
      expect(denied.status).toBe(409);
      expect(JSON.stringify(denied.body)).toContain("请退回申请");
      expect(await read(app.id)).toMatchObject({
        status: "pending",
        contactConsent: consent,
      });
      expect(
        (
          await p.findByID({
            collection: "users",
            id: owner.id,
            overrideAccess: true,
          })
        ).communityOffices || [],
      ).toEqual(officesBefore);
      const returned = await http(
        reviewer,
        action(app, {
          action: "review",
          decision: "returned",
          reviewNote: "请本人同意展示进群联系方式",
        }),
      );
      expect(returned.status).toBe(200);
      const resubmitted = await http(
        owner,
        action(returned.body.application, {
          action: "edit",
          ...values({ game, wechatQr: undefined }),
        }),
      );
      expect(resubmitted.status).toBe(200);
      expect(resubmitted.body.application.id).toBe(app.id);
      expect(resubmitted.body.application.contactConsent).toBe(true);
      const approved = await http(
        reviewer,
        action(resubmitted.body.application, {
          action: "review",
          decision: "approved",
        }),
      );
      expect(approved.status).toBe(200);
      const fresh = await p.findByID({
        collection: "users",
        id: owner.id,
        overrideAccess: true,
        depth: 0,
      });
      expect(fresh.roles).toEqual(["member"]);
      expect(fresh.communityOffices?.[0]).toMatchObject({
        game,
        status: "active",
        contactConsent: true,
        sourceApplication: app.id,
      });
    },
  );
  it("历史新建申请拒绝批准不会新建游戏或任职，也不改存量同意", async () => {
    const app = await legacy(await submit(), false),
      count = await p.count({ collection: "games", overrideAccess: true });
    expect(
      (
        await http(
          reviewer,
          action(app, { action: "review", decision: "approved" }),
        )
      ).status,
    ).toBe(409);
    expect(
      (await p.count({ collection: "games", overrideAccess: true })).totalDocs,
    ).toBe(count.totalDocs);
    expect(await read(app.id)).toMatchObject({
      status: "pending",
      contactConsent: false,
      game: null,
    });
  });
  it.each([undefined, false, null, "true"])(
    "已有true也不能从旧值合并绕过本人重提%s",
    async (contactConsent) => {
      const app = await submit(owner, { game });
      const returned = await http(
        reviewer,
        action(app, {
          action: "review",
          decision: "returned",
          reviewNote: "合成退回",
        }),
      );
      const snapshot = await read(app.id);
      expect(
        (
          await http(
            owner,
            action(returned.body.application, {
              action: "edit",
              ...values({ game, contactConsent }),
            }),
          )
        ).status,
      ).toBe(400);
      expect(await read(app.id)).toEqual(snapshot);
      await expect(
        editCommunityApplication(p, owner, app.id, snapshot.updatedAt, {
          status: "pending",
          reason: snapshot.reason,
          contactConsent,
        }),
      ).rejects.toThrow(error);
      await expect(
        p.update({
          collection: "community-applications",
          id: app.id,
          overrideAccess: false,
          user: owner,
          context: { communityApplicationEdit: true },
          data: {
            status: "pending",
            reason: snapshot.reason,
            contactConsent: contactConsent as boolean,
          },
        }),
      ).rejects.toThrow(error);
      expect(await read(app.id)).toEqual(snapshot);
    },
  );
  it("失败保留原资料；跨社群管理员无审核权、他人不能改稿、旧revision拒绝", async () => {
    const app = await submit(owner, { game }),
      snapshot = await read(app.id);
    expect(
      (
        await http(
          localAdmin,
          action(app, {
            action: "review",
            decision: "approved",
            contactConsent: true,
            roles: ["president"],
          }),
        )
      ).status,
    ).toBe(403);
    expect([403, 404]).toContain(
      (
        await http(
          outsider,
          action(app, { action: "edit", ...values({ game }) }),
        )
      ).status,
    );
    expect(
      (
        await http(
          owner,
          action(app, {
            action: "edit",
            ...values({ game }),
            revision: "synthetic-stale",
          }),
        )
      ).status,
    ).toBe(409);
    expect(await read(app.id)).toEqual(snapshot);
  });
  it("已批准名片false关闭展示仍可用；撤回无同意字段仍保留原服务", async () => {
    const app = await submit(owner, { game });
    const approved = await http(
      reviewer,
      action(app, { action: "review", decision: "approved" }),
    );
    expect(approved.status).toBe(200);
    const refreshed = await http(owner);
    const current = refreshed.body.docs.find(
      (row: CommunityApplication) => row.id === app.id,
    );
    expect(current).toBeTruthy();
    const hidden = await http(
      owner,
      action(current, {
        action: "card",
        contactConsent: false,
      }),
    );
    expect(hidden.status).toBe(200);
    expect(await read(app.id)).toMatchObject({
      status: "approved",
      contactConsent: false,
    });
    expect(
      (
        await p.find({
          collection: "community-applications",
          overrideAccess: false,
          user: null,
          context: { publicCommunityContacts: game },
          where: { id: { equals: app.id } },
        })
      ).docs,
    ).toEqual([]);
    const other = await submit(outsider, { game });
    expect(
      (await http(outsider, action(other, { action: "withdraw" }))).status,
    ).toBe(200);
  });
});
