import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultTheme, themeColors, themeFromPreference, themes, themeScheme } from "@/components/v2/theme";
import { pairHomeBlocks } from "@/components/v2/home-layout";
import type { HomeSectionKind } from "@/lib/v2";

describe("pixel themes keep stored preferences and the light-first default", () => {
  it("maps legacy light/dark cookies and unknown values", () => {
    expect(themeFromPreference(undefined)).toBe("winter");
    expect(defaultTheme).toBe("winter");
    expect(themeScheme(defaultTheme)).toBe("light");
    expect(themeFromPreference("light")).toBe("winter");
    expect(themeFromPreference("dark")).toBe("classic");
    expect(themeScheme(themeFromPreference("dark"))).toBe("dark");
    expect(themeFromPreference("summer")).toBe("summer");
    expect(themeFromPreference("simple")).toBe("simple");
    expect(themeFromPreference("toString")).toBe("winter");
    expect(themeFromPreference("<script>")).toBe("winter");
  });
  it("offers four labelled palettes with browser colours", () => {
    expect(themes.map((theme) => theme.label)).toEqual(["清华经典", "清凉夏夜", "温煦冬日", "简约"]);
    for (const theme of themes) expect(themeColors[theme.name]).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("home rows keep the CMS order", () => {
  const kinds = (rows: { kind: HomeSectionKind }[][]) => rows.map((row) => row.map((block) => block.kind));
  it("pairs only adjacent half-width blocks", () => {
    const order: HomeSectionKind[] = ["upcoming", "open", "notices", "promoted", "communities", "highlights", "about"];
    const rows = pairHomeBlocks(order.map((kind) => ({ kind })));
    expect(kinds(rows)).toEqual([["upcoming"], ["open"], ["notices"], ["promoted"], ["communities"], ["highlights", "about"]]);
    expect(rows.flat().map((block) => block.kind)).toEqual(order);
    expect(kinds(pairHomeBlocks([{ kind: "notices" }, { kind: "about" }, { kind: "highlights" }]))).toEqual([["notices", "about"], ["highlights"]]);
    expect(pairHomeBlocks([])).toEqual([]);
  });
});

describe("web palettes meet contrast pairs", () => {
  const css = readFileSync("src/app/(frontend)/pixel.css", "utf8");
  const palettes: Record<string, Record<string, string>> = {};
  for (const match of css.matchAll(/html:root\[data-z-palette="(\w+)"\]\s*\{([^}]*)\}/g)) {
    const values: Record<string, string> = {};
    for (const declaration of match[2].matchAll(/--z-([\w-]+):\s*([^;]+);/g)) values[declaration[1]] = declaration[2].trim();
    palettes[match[1]] = values;
  }
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  const pairs: [string, string, number][] = [
    ["ink", "paper", 4.5], ["ink", "surface", 4.5], ["muted", "paper", 4.5], ["muted", "surface", 4.5],
    ["action", "surface", 4.5], ["action-ink", "action", 4.5], ["accent-ink", "accent", 4.5], ["ink", "tint", 4.5],
    ["stage-ink", "stage", 4.5], ["stage-muted", "stage", 4.5], ["stage-ink", "stage-2", 4.5], ["accent", "surface", 3],
    ["field-border", "field", 3], ["focus", "surface", 3], ["danger", "danger-bg", 4.5], ["success", "success-bg", 4.5],
    ["warning", "warning-bg", 4.5], ["info", "info-bg", 4.5], ["header-ink", "header-bg", 4.5], ["footer-ink", "footer-bg", 4.5],
  ];
  it.each(["classic", "summer", "winter", "simple"])("%s", (name) => {
    const palette = palettes[name];
    expect(palette).toBeDefined();
    for (const [a, b, minimum] of pairs) {
      expect(palette[a], `${name} --z-${a}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ratio(palette[a], palette[b]), `${name} ${a}/${b}`).toBeGreaterThanOrEqual(minimum);
    }
  });
});

describe("original art and licensed font", () => {
  it("regenerates every committed pixel image from code", () => {
    expect(execFileSync(process.execPath, ["scripts/pixel-campus-art.mjs", "--check"], { encoding: "utf8" })).toContain("Checked 4");
  });
  it("ships only generated art plus the OFL font, without PR photos, landmarks or game marks", () => {
    expect(readdirSync("src/components/v2/pixel-art").sort()).toEqual([
      "ASSET-PROVENANCE.json", "campus-classic.png", "campus-summer.png", "campus-winter.png", "skyline-mask.png",
    ]);
    expect(existsSync("public/pixel-campus")).toBe(false);
    const license = readFileSync("src/components/v2/fonts/OFL.txt", "utf8");
    expect(license).toContain("Copyright (c) 2022, TakWolf");
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});

describe("shared contracts stay with main", () => {
  it("keeps CMS default titles, mini program review links and guest access rules", () => {
    expect(readFileSync("src/lib/v2/home-sections.ts", "utf8")).toContain('{ kind: "upcoming", enabled: true, title: "接下来的赛程" }');
    expect(readFileSync("src/lib/v2/account.ts", "utf8")).toContain('queues.push({ key: "showcase", title: "社群风采审核", href: "/community", webOnly: false');
    const access = readFileSync("src/lib/page-access.ts", "utf8");
    expect(access).toContain('const publicPaths = ["/events", "/announcements", "/login", "/register", "/account/reset", "/privacy", "/about", "/contact", "/join/staff"];');
    expect(access).not.toContain("pixel");
  });
});

describe("native mini program shares the pixel palettes (Fable stage)", () => {
  const tokens = JSON.parse(readFileSync("src/design/tokens.json", "utf8"));
  const css = readFileSync("src/app/(frontend)/pixel.css", "utf8");
  const value = (palette: string, name: string) =>
    new RegExp(`data-z-palette="${palette}"\\]\\s*\\{[^}]*--z-${name}:\\s*([^;]+);`).exec(css)?.[1];
  it("maps light to 温煦冬日 and dark to 清华经典, keeping a dark stage for light copy", () => {
    for (const name of ["paper", "surface", "ink", "muted", "action", "accent", "field-border"]) {
      expect(tokens.light[name], `light ${name}`).toBe(value("winter", name));
      expect(tokens.dark[name], `dark ${name}`).toBe(value("classic", name));
    }
    expect(tokens.light.stage).toBe("#1d1430");
    expect(tokens.light["stage-ink"]).toBe("#fbf6ff");
  });
  it("draws the stage on device without requests and keeps pause rules and the pixel layer", () => {
    const stage = readFileSync("miniprogram/src/components/zj-stage/index.js", "utf8");
    expect(stage).not.toMatch(/wx\.request|http\.|downloadFile|\.png|\.webp/);
    expect(stage).toContain("createIntersectionObserver");
    expect(stage).toMatch(/hide\(\) \{[^}]*this\.stop\(\)/);
    expect(readFileSync("miniprogram/src/app.wxss", "utf8")).toContain("像素校园");
    expect(readFileSync("miniprogram/src/templates/v2.wxss", "utf8")).toContain("像素校园");
    const auth = readFileSync("miniprogram/src/pages/auth/index.wxss", "utf8");
    expect(auth).toMatch(/\.auth-email \{[^}]*flex-direction: column/);
  });
});

describe("mobile filters", () => {
  it("gives each filter control a full row on phones", () => {
    const css = readFileSync("src/components/v2/layout.module.css", "utf8");
    const block = css.slice(css.lastIndexOf("@media (max-width: 640px)"));
    expect(block).toMatch(/\.filters label,\s*\.filters label\.filterCheck,\s*\.filterActions \{[^}]*flex: 1 1 100%;[^}]*min-width: 0;[^}]*max-width: 100%;/);
    expect(block).toMatch(/\.filters select,[^{]*\{[^}]*max-width: 100%;/);
  });
});
