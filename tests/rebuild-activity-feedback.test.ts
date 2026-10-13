import { afterEach, expect, it, vi } from "vitest";
import { activityRequest } from "../src/components/activity-pages/client-request";
import { workflowFeedback } from "../src/components/activity-pages/action-feedback";
afterEach(() => vi.unstubAllGlobals());
it("keeps a business conflict distinct from network uncertainty", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "问卷已更新，请重新核对" }, { status: 409 })));
  await expect(activityRequest("/synthetic", "PATCH", { revision: "old", answers: { name: "合成保留答案" } })).rejects.toThrow("问卷已更新，请重新核对");
});
it("a lost write response asks for receipt confirmation without claiming no write", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  await expect(activityRequest("/synthetic", "POST", {})).rejects.toThrow("提交结果尚未确认");
  await expect(activityRequest("/synthetic")).rejects.toThrow("网络连接中断");
});
it("a malformed or 500 mutation response remains uncertain", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("proxy unavailable", { status: 502 })).mockResolvedValueOnce(Response.json({ error: "internal SQL private detail" }, { status: 500 })));
  await expect(activityRequest("/synthetic", "PUT", {})).rejects.toThrow("提交结果尚未确认");
  await expect(activityRequest("/synthetic", "PUT", {})).rejects.toThrow("服务器暂时无法确认提交结果");
});
it("preserves successful receipt and request CAS fields", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ signup: { id: 11 }, message: "已保存" }));
  vi.stubGlobal("fetch", fetcher);
  const body = { version: "form-v3", revision: "receipt-v2", answers: { name: "合成资料" } };
  await expect(activityRequest("/synthetic", "PATCH", body)).resolves.toEqual({ signup: { id: 11 }, message: "已保存" });
  expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify(body));
});
it("server feedback exposes public workflow reasons but never unexpected exception details", () => {
  expect(workflowFeedback({ status: 409, isPublic: true, message: "批次已更新" })).toBe("批次已更新");
  expect(workflowFeedback(new Error("SELECT private answer"))).toContain("操作结果");
  expect(workflowFeedback(new Error("SELECT private answer"))).not.toContain("SELECT");
});
