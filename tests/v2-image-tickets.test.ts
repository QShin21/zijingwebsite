import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { APIError, type Payload } from "payload";
import type { User } from "../src/payload-types";
import { controlledImageRef, getImage, signImages } from "../src/lib/v2/images";
import { v2Request } from "../src/lib/v2/http";
import { serverURL } from "../src/lib/environment";

// In-memory DB/collection-access substitutes. Crypto, session checks, image
// authorization/projection, raster decoding and HTTP parsing execute for real.
const sid = "synthetic-session-not-a-real-credential";
const now = "2026-11-11T00:00:00.000Z";
const origin = new URL(serverURL).origin;
let raster: string, replacement: string, user: User & { _sid: string }, p: Payload;
let uploadOwner: number, consumed: boolean, published: boolean, consent: boolean;
let source: string, sessionActive: boolean;
const authenticated = () => ({ ...user, _sid: sid });
const canonical = (kind = "upload", id = 7, index = 0) => controlledImageRef(kind as "upload", id, index, raster)!.src;
const issue = (sources: unknown = [canonical()]) => signImages(p, authenticated(), { sources });
function input(url: string) {
  const parsed = new URL(url, origin), parts = parsed.pathname.split("/");
  return { kind: parts[4], id: parts[5], index: parts[6], version: parsed.searchParams.get("v"), ticket: parsed.searchParams.get("ticket") };
}
const read = (url: string, viewer: User | null = null, etag?: string) => getImage(p, viewer, { ...input(url), ifNoneMatch: etag });
async function post(body: unknown, headers: Record<string, string> = { origin, cookie: "synthetic-auth" }) {
  return v2Request(p, new Request(origin + "/api/v2/images/sign", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }), ["images", "sign"]);
}
beforeAll(async () => {
  raster = "data:image/png;base64," + (await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer()).toString("base64");
  replacement = "data:image/png;base64," + (await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).png().toBuffer()).toString("base64");
});
beforeEach(() => {
  vi.useRealTimers();
  user = { id: 1, name: "合成成员", email: "synthetic@example.invalid", roles: ["member"], accountStatus: "active", updatedAt: now, collection: "users", _sid: sid } as User & { _sid: string };
  uploadOwner = 1; consumed = false; published = true; consent = true; source = raster; sessionActive = true;
  p = {
    secret: "synthetic-test-only-32-character-secret-never-production",
    auth: vi.fn(async ({ headers }: { headers: Headers }) => ({ user: headers.has("authorization") || headers.has("cookie") ? authenticated() : null })),
    findByID: vi.fn(async (args: { collection: string; id: number; select?: Record<string, boolean>; user?: User; overrideAccess?: boolean }) => {
      if (args.collection === "users") {
        if (args.id === 2) return { id: 2, communityOffices: [{ game: 3, status: "active", contactConsent: consent }] };
        if (args.select?.sessions) return { sessions: sessionActive ? [{ id: sid, expiresAt: new Date(Date.now() + 3600_000).toISOString() }] : [] };
        return { ...user };
      }
      if (args.collection === "games") return { id: 3, _status: published ? "published" : "draft" };
      if (args.collection === "pending-uploads") {
        if (args.overrideAccess !== false || args.user?.id !== uploadOwner) throw new APIError("private DB diagnostic", 404);
        return { id: 7, owner: uploadOwner, data: source, consumedAt: consumed ? now : null, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
      }
      if (args.collection === "events") return { id: 7, _status: published ? "published" : "draft", postImages: [{ source }] };
      if (args.collection === "community-showcase") return { id: 7, game: 3, status: published ? "visible" : "hidden", author: 8, images: [{ source }] };
      throw new Error("unexpected collection " + args.collection);
    }),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === "community-applications") return { docs: [{ wechatQr: source }] };
      throw new Error("unexpected collection " + collection);
    }),
  } as unknown as Payload;
});

describe("short-lived image tickets with live account/session/object authorization", () => {
  it("mints scoped URLs without embedded image or session secrets; native GET works without JWT", async () => {
    const result = await issue();
    expect(result.images).toHaveLength(1);
    expect(Date.parse(result.expiresAt) - Date.now()).toBeLessThanOrEqual(60_000);
    expect(JSON.stringify(result)).not.toContain(sid);
    expect(JSON.stringify(result)).not.toContain("data:image");
    const response = await read(result.images[0].url);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(20);
  });
  it("enforces current owner access before minting and does not accept an unversioned URL", async () => {
    uploadOwner = 9;
    await expect(issue()).rejects.toMatchObject({ status: 404 });
    await expect(issue(["/api/v2/images/upload/7/0"])).rejects.toMatchObject({ status: 400 });
  });
  it("requires a current session and current member even for otherwise public images", async () => {
    await expect(signImages(p, null, { sources: [canonical("event-post")] })).rejects.toMatchObject({ status: 401 });
    await expect(signImages(p, { ...user, _sid: undefined } as unknown as User, { sources: [canonical()] })).rejects.toMatchObject({ status: 401 });
    sessionActive = false;
    await expect(issue()).rejects.toMatchObject({ status: 401 });
    sessionActive = true; user.accountStatus = "suspended";
    await expect(issue()).rejects.toMatchObject({ status: 401 });
  });
  it.each([[], Array(21).fill("x"), null, ["https://evil.invalid/image"], ["//evil.invalid/image"], ["/api/v2/images/upload/7/0?v=abcdef0123456789&user=2"], ["/api/v2/images/upload/2147483648/0?v=abcdef0123456789"], ["/api/v2/images/upload/7/2147483648?v=abcdef0123456789"]])("rejects noncanonical or unbounded batch %j", async sources => {
    await expect(issue(sources)).rejects.toMatchObject({ status: 400 });
  });
  it("deduplicates a valid batch without expanding authority", async () => {
    const result = await issue([canonical(), canonical(), canonical("event-post")]);
    expect(result.images).toHaveLength(2);
  });
  it("rejects signature tampering, different object/version, different authenticated user, and expiry", async () => {
    const url = (await issue()).images[0].url;
    const token = input(url).ticket!;
    await expect(read(url.replace(token, token.slice(0, -2) + "xx"))).rejects.toMatchObject({ status: 404 });
    await expect(read(url.replace("/7/0", "/8/0"))).rejects.toMatchObject({ status: 404 });
    await expect(read(url.replace(/v=[a-f0-9]{16}/, "v=0000000000000000"))).rejects.toMatchObject({ status: 404 });
    await expect(read(url, { ...user, id: 9 })).rejects.toMatchObject({ status: 404 });
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 60_001);
    await expect(read(url)).rejects.toMatchObject({ status: 404 });
    vi.useRealTimers();
  });
  it("revokes on session logout, account suspension or account revision changes", async () => {
    const url = (await issue()).images[0].url;
    sessionActive = false;
    await expect(read(url)).rejects.toMatchObject({ status: 404 });
    sessionActive = true; user.accountStatus = "suspended";
    await expect(read(url)).rejects.toMatchObject({ status: 404 });
    user.accountStatus = "active"; user.updatedAt = "2026-11-11T00:01:00.000Z";
    await expect(read(url)).rejects.toMatchObject({ status: 404 });
  });
  it("rechecks object ownership, consumption and byte version before conditional caching", async () => {
    const url = (await issue()).images[0].url;
    const etag = (await read(url)).headers.get("etag")!;
    expect((await read(url, null, etag)).status).toBe(304);
    source = replacement;
    await expect(read(url, null, etag)).rejects.toMatchObject({ status: 404 });
    source = raster; consumed = true;
    await expect(read(url, null, etag)).rejects.toMatchObject({ status: 404 });
    consumed = false; uploadOwner = 9;
    await expect(read(url, null, etag)).rejects.toMatchObject({ status: 404 });
  });
  it("rechecks source visibility and parent publication", async () => {
    const url = (await issue([canonical("showcase")])).images[0].url;
    published = false;
    await expect(read(url, null, "*")).rejects.toMatchObject({ status: 404 });
  });
  it("rechecks contact consent on every image read", async () => {
    const url = (await issue([canonical("contact", 3, 2)])).images[0].url;
    expect((await read(url)).status).toBe(200);
    consent = false;
    await expect(read(url, null, "*")).rejects.toMatchObject({ status: 404 });
  });
  it("legacy authenticated access remains usable but is never immutable", async () => {
    const args = input(canonical());
    expect((await getImage(p, user, args)).headers.get("Cache-Control")).toBe("private, no-store");
    await expect(getImage(p, null, args)).rejects.toMatchObject({ status: 404 });
  });
});

describe("image ticket HTTP endpoint with real image services", () => {
  it("accepts Cookie same-origin and JWT without Cookie fallback; serves the signed image", async () => {
    const response = await post({ sources: [canonical()] });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    const signed = new URL(body.images[0].url, origin);
    const image = await v2Request(p, new Request(signed), signed.pathname.slice("/api/v2/".length).split("/"));
    expect(image.status).toBe(200);
    const jwt = await post({ sources: [canonical()] }, { authorization: "JWT synthetic", cookie: "synthetic-other" });
    expect(jwt.status).toBe(200);
    const headers = vi.mocked(p.auth).mock.calls.at(-1)![0].headers;
    expect(headers.get("cookie")).toBeNull();
  });
  it("denies anonymous, wrong origin, forged subject/expiry and arbitrary URL signing", async () => {
    expect((await post({ sources: [canonical()] }, { origin })).status).toBe(401);
    expect((await post({ sources: [canonical()] }, { origin: "https://evil.invalid", cookie: "synthetic" })).status).toBe(403);
    expect((await post({ sources: [canonical()], user: 2, expiresAt: "2099-01-01" })).status).toBe(400);
    expect((await post({ sources: ["https://evil.invalid/image"] })).status).toBe(400);
  });
  it("returns no signed URLs on a partial authorization failure, with safe generic errors", async () => {
    uploadOwner = 9;
    const response = await post({ sources: [canonical("event-post"), canonical()] });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.text();
    expect(body).not.toMatch(/ticket=|diagnostic|session|synthetic@example/);
  });
});
