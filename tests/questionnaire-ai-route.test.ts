import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Identity } from "../src/lib/rules";
const state = vi.hoisted(() => ({
  user: null as Identity | null,
  generate: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
}));
vi.mock("../src/lib/content", () => ({
  cms: async () => ({ auth: async () => ({ user: state.user }) }),
}));
vi.mock("../src/lib/questionnaire-ai", async (original) => ({
  ...(await original<typeof import("../src/lib/questionnaire-ai")>()),
  generateQuestionnaire: state.generate,
  reserveGeneration: state.reserve,
}));
import {
  GET,
  POST,
} from "../src/app/(frontend)/api/questionnaires/generate/route";
beforeEach(() => {
  state.user = { id: 1, roles: ["vicePresident"] };
  state.generate.mockReset();
  state.reserve.mockReset();
  state.release.mockReset();
  state.reserve.mockResolvedValue(state.release);
  state.generate.mockResolvedValue({ title: "test", questions: [] });
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "unit-test-private-key");
  vi.stubEnv("SERVER_URL", "https://home.thuzijing.top");
});
afterEach(() => vi.unstubAllEnvs());
const request = (
  data: unknown = {
    description: "制作通用的活动满意度反馈问卷",
    audience: "成员",
    count: 3,
    logic: false,
  },
  origin = "https://home.thuzijing.top",
) =>
  new Request("https://home.thuzijing.top/api/questionnaires/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(data),
  });
it("rejects guests, ordinary members and suspended managers before reserving quota", async () => {
  for (const user of [
    null,
    { id: 2, roles: ["member"] },
    { id: 3, roles: ["president"], accountStatus: "suspended" },
  ]) {
    state.user = user;
    const response = await POST(request());
    expect([401, 403]).toContain(response.status);
  }
  expect(state.reserve).not.toHaveBeenCalled();
  expect(state.generate).not.toHaveBeenCalled();
});
it("rejects cross-origin, malformed and oversized input before quota or upstream requests", async () => {
  expect((await POST(request({}, "https://untrusted.example"))).status).toBe(
    403,
  );
  expect((await POST(request({}))).status).toBe(400);
  expect((await POST(request({ description: "x".repeat(20000) }))).status).toBe(
    400,
  );
  expect(state.reserve).not.toHaveBeenCalled();
});
it("returns only safe capability metadata", async () => {
  const response = await GET(
    new Request("https://home.thuzijing.top/api/questionnaires/generate"),
  );
  expect(await response.json()).toEqual({
    enabled: true,
    model: "DeepSeek-V4.1-Flash",
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("releases concurrency after success and failure without publishing or exposing raw errors", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(state.release).toHaveBeenCalledOnce();
  state.generate.mockRejectedValue(new Error("raw secret from provider"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("raw secret");
  expect(state.release).toHaveBeenCalledTimes(2);
});
it("does not spend quota when AI is unconfigured", async () => {
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "");
  expect((await POST(request())).status).toBe(503);
  expect(state.reserve).not.toHaveBeenCalled();
});
