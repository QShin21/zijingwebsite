import { describe, expect, it } from "vitest";
import {
  themeFromPreference,
  themeScheme,
  themes,
} from "../src/components/v2/theme";
import { isGuestPage } from "../src/lib/page-access";

describe("pixel campus themes", () => {
  it("defaults to 清华经典 and migrates existing explicit preferences", () => {
    for (const value of [undefined, "invalid", "__proto__", "constructor"])
      expect(themeFromPreference(value)).toBe("classic");
    expect(themeFromPreference("light")).toBe("winter");
    expect(themeFromPreference("dark")).toBe("classic");
    for (const value of Object.keys(themes))
      expect(themeFromPreference(value)).toBe(value);
    expect(Object.values(themes)).toEqual([
      "清华经典",
      "清凉夏夜",
      "温煦冬日",
      "简约",
    ]);
  });
  it("uses valid browser colour schemes for all four modes", () => {
    expect(themeScheme("classic")).toBe("dark");
    expect(themeScheme("summer")).toBe("dark");
    expect(themeScheme("winter")).toBe("light");
    expect(themeScheme("simple")).toBe("light");
  });
});

describe("public campus art has a narrow allowlist", () => {
  it("loads the public covers, font and photographs without opening member routes", () => {
    for (const asset of [
      "pixel-campus.jpg",
      "campus-summer.webp",
      "campus-winter.webp",
      "fusion-pixel.woff2",
      "esports-fistbump.jpg",
      "esports-match.jpg",
      "esports-trophy.jpg",
    ])
      expect(isGuestPage(`/pixel-campus/${asset}`)).toBe(true);
    for (const route of [
      "/pixel-campus/private.jpg",
      "/pixel-campus/pixel-campus.jpg/private",
      "/pixel-campus/../community",
      "/community",
      "/teams",
      "/account",
      "/news",
    ])
      expect(isGuestPage(route)).toBe(false);
  });
});
