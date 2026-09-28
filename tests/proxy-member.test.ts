import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyMember } from "../src/lib/proxy-member";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("代理会话验证", () => {
  it("无凭据无需调用会话接口", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await proxyMember(new Headers())).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("只向实际端口的本机接口转发凭据，不信任调用者 Host", async () => {
    vi.stubEnv("PORT", "3101");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ user: { id: 5, accountStatus: "active" } }));
    vi.stubGlobal("fetch", fetcher);
    expect(await proxyMember(new Headers({ cookie: "payload-token=test", host: "untrusted.invalid", authorization: "Bearer test", origin: "https://untrusted.invalid", "sec-fetch-site": "cross-site" }))).toEqual({ id: 5, accountStatus: "active" });
    expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:3101/api/users/me");
    const options = fetcher.mock.calls[0][1];
    expect(options.headers.get("host")).toBeNull();
    expect(options.headers.get("cookie")).toBe("payload-token=test");
    expect(options.headers.get("origin")).toBe("https://untrusted.invalid");
    expect(options.headers.get("sec-fetch-site")).toBe("cross-site");
    expect(options.redirect).toBe("error");
    expect(options.cache).toBe("no-store");
  });
  it("无效凭据拒绝访问，服务故障不会当作有效登录", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect(await proxyMember(new Headers({ cookie: "payload-token=invalid" }))).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(proxyMember(new Headers({ cookie: "payload-token=invalid" }))).rejects.toThrow("Session verification unavailable");
  });
});
