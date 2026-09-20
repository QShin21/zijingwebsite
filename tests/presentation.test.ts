import { describe, expect, it } from "vitest";
import { dateParts, publicHref } from "../src/lib/presentation";

describe("public presentation boundaries", () => {
  it.each(["/join", "/events/example?from=home#details", "https://example.com/form"]) (
    "preserves an allowed destination: %s", (value) => {
      expect(publicHref(value, "/join")).toBe(value);
    },
  );
  it.each([undefined, null, "", "javascript:alert(1)", "data:text/html,test", "//example.com", "/\\example.com", "http://example.com", "https://user:password@example.com", " /events", "/events\n", 123]) (
    "rejects an unsafe or malformed destination: %s", (value) => {
      expect(publicHref(value, "/join")).toBe("/join");
    },
  );
  it("uses the same China-time calendar date on server and browser", () => {
    expect(dateParts("2026-09-20T16:30:00Z")).toEqual({ year: "2026", month: "09", day: "21" });
  });
  it.each([undefined, null, "", "not-a-date"])("omits invalid date stamps: %s", (value) => {
    expect(dateParts(value)).toBeNull();
  });
});
