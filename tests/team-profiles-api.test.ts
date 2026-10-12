import { afterEach, describe, expect, it, vi } from "vitest";
import { APIError } from "payload";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../src/lib/content", () => ({
  cms: async () => ({ auth: mocks.auth }),
}));
vi.mock("../src/lib/team-profiles", () => ({
  readTeamProfiles: mocks.read,
  saveTeamProfile: mocks.save,
}));
import {
  GET,
  PUT,
} from "../src/app/(frontend)/api/team-profiles/[teamID]/route";

const context = { params: Promise.resolve({ teamID: "12" }) };
const request = (
  body: unknown = { revision: null, profile: {} },
  headers: Record<string, string> = {},
) =>
  new Request("http://localhost:3000/api/team-profiles/12", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      ...headers,
    },
    body: JSON.stringify(body),
  });
afterEach(() => vi.resetAllMocks());
describe("简介 HTTP 边界（服务响应合成替身，非成员集成验收）", () => {
  it("未登录拒绝且不访问资料服务", async () => {
    mocks.auth.mockResolvedValue({ user: null });
    const response = await GET(
      new Request("http://localhost:3000/api/team-profiles/12"),
      context,
    );
    expect(response.status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("无效标识在任何读取前拒绝", async () => {
    expect(
      (
        await GET(new Request("http://localhost:3000/api/team-profiles/1e2"), {
          params: Promise.resolve({ teamID: "1e2" }),
        })
      ).status,
    ).toBe(400);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("只返回受控 DTO，未知错误不泄露私人答案或 SQL", async () => {
    mocks.auth.mockResolvedValue({ user: { id: 3 } });
    const view = {
      profiles: [],
      own: { eligible: false, membershipVersion: null, profile: null },
    };
    mocks.read.mockResolvedValue(view);
    expect(
      await (
        await GET(
          new Request("http://localhost:3000/api/team-profiles/12"),
          context,
        )
      ).json(),
    ).toEqual(view);
    mocks.read.mockRejectedValue(new Error("SQL private-answer-secret"));
    const response = await GET(
      new Request("http://localhost:3000/api/team-profiles/12"),
      context,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-answer-secret");
  });
  it("跨站保存拒绝，伪造上下文/成员/账号不得进入服务", async () => {
    mocks.auth.mockResolvedValue({ user: { id: 3 } });
    expect(
      (await PUT(request({}, { Origin: "https://untrusted.example" }), context))
        .status,
    ).toBe(403);
    for (const key of [
      "context",
      "overrideAccess",
      "membership",
      "user",
      "game",
      "team",
      "status",
    ])
      expect(
        (
          await PUT(
            request({ profile: {}, revision: null, [key]: true }),
            context,
          )
        ).status,
      ).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("限制请求格式/长度，保留权限及冲突错误码", async () => {
    mocks.auth.mockResolvedValue({ user: { id: 3 } });
    expect(
      (await PUT(request({}, { "Content-Type": "text/plain" }), context))
        .status,
    ).toBe(400);
    expect(
      (await PUT(request({}, { "Content-Length": "2900001" }), context)).status,
    ).toBe(400);
    mocks.save.mockRejectedValue(new APIError("入队资格已撤销", 403));
    expect((await PUT(request(), context)).status).toBe(403);
    mocks.save.mockRejectedValue(new APIError("版本已更新", 409));
    expect((await PUT(request(), context)).status).toBe(409);
  });
  it("周期凭据仅在请求顶层传给服务，周期冲突返回可识别409", async () => {
    mocks.auth.mockResolvedValue({ user: { id: 3 } });
    mocks.save.mockRejectedValue(
      new APIError("入队周期已更新", 409, { code: "PROFILE_PERIOD_CHANGED" }),
    );
    const version = "v1." + "a".repeat(43);
    const response = await PUT(
      request({ revision: 1, profile: {}, membershipVersion: version }),
      context,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "入队周期已更新",
      code: "PROFILE_PERIOD_CHANGED",
    });
    expect(mocks.save.mock.calls[0].slice(2)).toEqual([12, 1, {}, version]);
  });
});
