import { describe, expect, it } from "vitest";
import { safeReturnPath } from "../src/components/account-pages/auth-return";

describe("authentication return paths", () => {
  it.each([
    ["/account", "/account"],
    ["/community/apply?edit=42", "/community/apply?edit=42"],
    [
      "/teams/honors?view=mine&team=7#records",
      "/teams/honors?view=mine&team=7#records",
    ],
    ["/news/campus?search=hello%20world", "/news/campus?search=hello%20world"],
    ["/events/../announcements", "/announcements"],
    ["/", "/"],
  ])("keeps the same-origin destination %s", (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
  it.each([
    undefined,
    null,
    ["/account"],
    "",
    "account",
    "https://outside.invalid",
    "//outside.invalid",
    "/\\outside.invalid",
    "/%5coutside.invalid",
    "/%2foutside.invalid",
    "/%252foutside.invalid",
    "/.//outside.invalid",
    "/..//outside.invalid",
    "/%2e%2e//outside.invalid",
    "/safe/../..//outside.invalid",
    "/%0d%0aLocation:https://outside.invalid",
    "/%250aoutside.invalid",
    "/\u0000outside.invalid",
    "/\u007foutside.invalid",
    "/login",
    "/register?returnTo=/events",
    "/account/reset",
    "/events/../login",
    "/%6cogin",
    "/%256cogin",
    "/https%3a%2f%2foutside.invalid",
    "/javascript%3aalert(1)",
    "/%",
    "/%GG",
  ])("rejects an unsafe, invalid or cyclic destination %s", (input) => {
    expect(safeReturnPath(input)).toBe("/account");
  });
  it("supports a caller-provided fallback without transforming it", () => {
    expect(safeReturnPath("//outside.invalid", "/events")).toBe("/events");
  });
});
