import { describe, it, expect } from "vitest";
import {
  canPublish,
  eventState,
  registrationState,
  safeURL,
  teamIDs,
  formatDate,
} from "../src/lib/rules";
const base = {
  _status: "published",
  registrationURL: "https://example.com/form",
  registrationStart: "2026-09-20T00:00:00Z",
  registrationEnd: "2026-09-20T16:00:00Z",
};
describe("报名与时间边界", () => {
  it.each([
    ["2026-09-19T23:59:59Z", "尚未开始"],
    ["2026-09-20T00:00:00Z", "报名开放"],
    ["2026-09-20T15:59:59Z", "报名开放"],
    ["2026-09-20T16:00:00Z", "已截止"],
  ])("%s → %s", (time, state) =>
    expect(registrationState(base, new Date(time))).toBe(state),
  );
  it.each([
    { _status: "draft" },
    { archived: true },
    { registrationClosed: true },
    { lifecycle: "cancelled" },
    { lifecycle: "postponed" },
    { lifecycle: "ended" },
  ])("不满足公开开放条件：%o", (extra) =>
    expect(registrationState({ ...base, ...extra })).toBe("已关闭"),
  );
  it("无截止、文字渠道、缺失渠道", () => {
    expect(
      registrationState({ _status: "published", channelText: "公开渠道" }),
    ).toBe("报名开放");
    expect(registrationState({ _status: "published" })).toBe("暂无报名渠道");
  });
  it("人工状态优先、结束边界、时区跨日", () => {
    expect(eventState({ lifecycle: "cancelled", endAt: "2020-01-01" })).toBe(
      "已取消",
    );
    expect(
      eventState(
        { endAt: "2026-09-20T16:00:00Z" },
        new Date("2026-09-20T16:00:00Z"),
      ),
    ).toBe("已结束");
    expect(formatDate("2026-09-20T16:00:00Z")).toContain("21");
  });
});
describe("权限与外链", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "http://example.com",
    "//example.com",
    "https://user:password@example.com",
    "not a URL",
  ])("拒绝 %s", (v) => expect(safeURL(v)).toBe(false));
  it("合法 URL 与角色", () => {
    expect(safeURL("https://example.com/form?a=1")).toBe(true);
    expect(canPublish({ id: 1, roles: ["communityAdmin"] })).toBe(false);
    expect(canPublish({ id: 1, roles: ["vicePresident"] })).toBe(true);
    expect(teamIDs({ id: 1, teams: [{ id: 3 }, 4] })).toEqual(["3", "4"]);
  });
});
