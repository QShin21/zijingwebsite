import { i18nStub } from "./i18n-stubs";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { safeReturnPath } from "@/components/account-pages/auth-return";
import { teamHonorQuery, teamHonorScopeID, teamHonorSubmissionHref } from "@/components/TeamHonorNavigation";
import { LoginWall } from "@/components/v2/ui";
import { teamLoginHref } from "@/app/(frontend)/teams/auth-return";

const require = createRequire(import.meta.url);
const source = (path: string) => readFileSync(path, "utf8");
const cssModule = { __esModule: true, default: { workspace: "workspace" } };

function evaluate(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (name in dependencies) return dependencies[name];
      if (i18nStub(name)) return i18nStub(name);
      if (name.endsWith(".css")) return cssModule;
      if (name.startsWith("@/") || name.startsWith(".")) return {};
      if (name === "next/link") return { __esModule: true, default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) };
      return require(name);
    },
    URLSearchParams,
  });
  return exports;
}

function destination(href: string) {
  const login = new URL(href, "https://synthetic.invalid");
  expect(login.pathname).toBe("/login");
  return login.searchParams.get("returnTo");
}

describe("team login handoff", () => {
  it.each([
    ["/teams/apply", { edit: "15", page: "2", game: "7" }, "/teams/apply?page=2&edit=15"],
    ["/teams/recruitment", { page: "3", ownPage: "4", membersPage: "5", edit: "9" }, "/teams/recruitment?page=3&ownPage=4&membersPage=5"],
    ["/teams/manage", { game: "7", page: "2", reviewPage: "3", create: "1" }, "/teams/manage?page=2&reviewPage=3&game=7"],
    ["/teams/manage/22", { edit: "17", create: "yes", status: "returned", page: "4", membersPage: "2", batchesPage: "3" }, "/teams/manage/22?page=4&membersPage=2&batchesPage=3&edit=17&status=returned&create=1"],
    ["/teams/profiles/31", { page: "3" }, "/teams/profiles/31"],
    ["/teams/recruitment/40", {}, "/teams/recruitment/40"],
  ])("retains the meaningful state for %s", (path, query, expected) => {
    expect(destination(teamLoginHref(path, query))).toBe(expected);
  });

  it("rejects external paths, controls and unexpected query values", () => {
    for (const path of ["//outside.invalid", "/%2f%2foutside.invalid", "/teams/manage/1/../../login", "/teams/manage/1?next=https://outside.invalid"]) {
      expect(destination(teamLoginHref(path))).toBe("/teams");
    }
    expect(destination(teamLoginHref("/teams/manage/42", {
      edit: "//outside.invalid", status: "pending&next=https://outside.invalid", page: "999999", membersPage: ["2", "3"],
    }))).toBe("/teams/manage/42?page=10000");
  });

  it("executes each anonymous route guard before any team data lookup", async () => {
    const find = vi.fn(() => { throw new Error("unexpected data lookup"); });
    const payload = { auth: async () => ({ user: null }), find, findByID: find };
    const redirect = (location: string) => { throw Object.assign(new Error("redirect"), { location }); };
    const notFound = () => { throw new Error("notFound"); };
    const positiveID = (value: unknown) => typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
    const dependencies = {
      "next/headers": { headers: async () => new Headers() },
      "next/navigation": { redirect, notFound },
      "@/lib/content": { cms: async () => payload },
      "@/lib/team-memberships": { positiveID },
      "@/lib/team-profiles-model": { teamProfileID: (value: unknown) => { const id = positiveID(value); if (!id) throw new Error("invalid"); return id; } },
      "@/lib/rules": { canParticipate: () => false },
      "../auth-return": { teamLoginHref },
      "../../auth-return": { teamLoginHref },
    };
    const cases = [
      ["src/app/(frontend)/teams/apply/page.tsx", { searchParams: Promise.resolve({ edit: "15", page: "2" }) }, "/teams/apply?page=2&edit=15"],
      ["src/app/(frontend)/teams/recruitment/page.tsx", { searchParams: Promise.resolve({ ownPage: "4" }) }, "/teams/recruitment?ownPage=4"],
      ["src/app/(frontend)/teams/recruitment/[id]/page.tsx", { params: Promise.resolve({ id: "40" }) }, "/teams/recruitment/40"],
      ["src/app/(frontend)/teams/manage/page.tsx", { searchParams: Promise.resolve({ game: "7" }) }, "/teams/manage?game=7"],
      ["src/app/(frontend)/teams/manage/[id]/page.tsx", { params: Promise.resolve({ id: "22" }), searchParams: Promise.resolve({ edit: "17", status: "returned" }) }, "/teams/manage/22?edit=17&status=returned"],
      ["src/app/(frontend)/teams/profiles/[teamID]/page.tsx", { params: Promise.resolve({ teamID: "31" }) }, "/teams/profiles/31"],
    ] as const;
    for (const [path, props, expected] of cases) {
      const page = evaluate(path, dependencies).default as (props: unknown) => Promise<unknown>;
      let error: unknown;
      try { await page(props); } catch (cause) { error = cause; }
      expect(destination((error as { location: string }).location), path).toBe(expected);
    }
    expect(find).not.toHaveBeenCalled();
  });

  it("keeps the team-management permission check after login", async () => {
    const user = { id: 9, accountStatus: "active" };
    const canManageTeam = vi.fn(async () => false);
    const find = vi.fn(() => { throw new Error("unexpected data lookup"); });
    const page = evaluate("src/app/(frontend)/teams/manage/[id]/page.tsx", {
      "next/headers": { headers: async () => new Headers() },
      "next/navigation": { redirect: () => { throw new Error("unexpected login"); }, notFound: () => { throw new Error("notFound"); } },
      "@/lib/content": { cms: async () => ({ auth: async () => ({ user }), find, findByID: find }) },
      "@/lib/team-memberships": { positiveID: (value: string) => Number(value), canManageTeam },
      "../../auth-return": { teamLoginHref },
    }).default as (props: unknown) => Promise<unknown>;
    await expect(page({ params: Promise.resolve({ id: "22" }), searchParams: Promise.resolve({}) })).rejects.toThrow("notFound");
    expect(canManageTeam).toHaveBeenCalledWith(expect.anything(), user, 22);
    expect(find).not.toHaveBeenCalled();
  });
});

describe("private honor views", () => {
  it.each(["mine", "review"] as const)("passes the %s scope from the page into the workspace", async (view) => {
    const Panel = () => null;
    const read = vi.fn();
    const page = evaluate("src/app/(frontend)/teams/honors/page.tsx", {
      "next/navigation": { notFound: () => { throw new Error("notFound"); } },
      "@/lib/v2": { getHonors: vi.fn() },
      "@/components/TeamHonorsPanel": { TeamHonorsPanel: Panel },
      "@/components/TeamHonorNavigation": { teamHonorScopeID },
      "@/components/v2/data": { read, request: async () => ({ payload: {}, user: null }), pageNumber: (value: string) => Number(value), single: (value: string) => value },
    }).default as (props: unknown) => Promise<ReactElement>;
    const root = await page({ searchParams: Promise.resolve({ view, team: "22", game: "24", page: "3" }) });
    const find = (node: unknown): ReactElement | undefined => {
      if (Array.isArray(node)) return node.map(find).find(Boolean);
      if (!isValidElement<{ children?: unknown }>(node)) return undefined;
      return node.type === Panel ? node : find(node.props.children);
    };
    expect(find(root)?.props).toMatchObject({ view, team: 22, game: 24, page: 3, user: null });
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["mine", "review"] as const)("shows a login wall for anonymous %s without loading archives or private records", async (view) => {
    const archives = vi.fn(async () => []);
    const availableTeams = vi.fn(async () => []);
    const honorWorkspace = vi.fn();
    const panel = evaluate("src/components/TeamHonorsPanel.tsx", {
      "@/lib/rules": { canParticipate: (user: { id?: number } | null) => Boolean(user?.id) },
      "@/lib/team-honor-service": { teamHonorService: { archives, availableTeams } },
      "@/lib/team-honor-web": { honorWorkspace, honorCanReview: () => false },
      "./TeamHonorNavigation": { teamHonorQuery, teamHonorSubmissionHref },
      "./account-pages/auth-return": { safeReturnPath },
      "./v2/ui": { LoginWall },
    }).TeamHonorsPanel as (props: unknown) => Promise<ReactElement>;
    const element = await panel({ payload: {}, user: null, view, page: 3, team: 22, game: 24 });
    expect(isValidElement(element)).toBe(true);
    const html = renderToStaticMarkup(element);
    expect(html).toContain(view === "mine" ? "登录后查看我的投稿" : "登录后查看荣誉审核");
    expect(html).toContain(`returnTo=${encodeURIComponent(`/teams/honors?view=${view}&team=22&game=24&page=3`)}`);
    expect(archives).not.toHaveBeenCalled();
    expect(availableTeams).not.toHaveBeenCalled();
    expect(honorWorkspace).not.toHaveBeenCalled();
  });

  it("continues to load signed-in review records through the existing permission-aware workspace", async () => {
    const archives = vi.fn();
    const availableTeams = vi.fn(async () => []);
    const honorWorkspace = vi.fn(async () => ({ docs: [], totalDocs: 0, totalPages: 0 }));
    const panel = evaluate("src/components/TeamHonorsPanel.tsx", {
      "@/lib/rules": { canParticipate: (user: { id?: number } | null) => Boolean(user?.id) },
      "@/lib/team-honor-service": { teamHonorService: { archives, availableTeams } },
      "@/lib/team-honor-web": { honorWorkspace, honorCanReview: () => false },
      "./TeamHonorNavigation": { teamHonorQuery, teamHonorSubmissionHref },
      "./account-pages/auth-return": { safeReturnPath },
      "./v2/ui": { LoginWall },
    }).TeamHonorsPanel as (props: unknown) => Promise<ReactElement>;
    const payload = {}, user = { id: 9 };
    await panel({ payload, user, view: "review", page: 3, team: 22, game: 24 });
    expect(honorWorkspace).toHaveBeenCalledWith(payload, user, "review", 3, { team: 22, game: 24 });
    expect(availableTeams).toHaveBeenCalledWith(payload, user);
    expect(archives).not.toHaveBeenCalled();
  });
});

describe("stage contrast", () => {
  type RGB = [number, number, number];
  const palettes: Record<string, Record<string, string>> = {};
  for (const match of source("src/app/(frontend)/pixel.css").matchAll(/html:root\[data-z-palette="(\w+)"\]\s*\{([^}]*)\}/g)) {
    palettes[match[1]] = Object.fromEntries([...match[2].matchAll(/--z-([\w-]+):\s*([^;]+);/g)].map((value) => [value[1], value[2].trim()]));
  }
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
  const luminance = (color: RGB) => color.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a: RGB, b: RGB) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const over = (color: RGB, alpha: number, back: RGB) => color.map((v, i) => alpha * v + (1 - alpha) * back[i]) as RGB;
  const hsl = (h: number): RGB => {
    const s = 0.85, l = 0.55, a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map((n) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }) as RGB;
  };
  const teamCSS = source("src/app/(frontend)/teams/[slug]/team.module.css");
  const archiveCSS = source("src/components/team-pages/TeamPages.module.css");
  const heroAlpha = Number(/hsl\(calc\(var\(--hue\) \+ 40\) 85% 55% \/ ([\d.]+)\)/.exec(teamCSS)?.[1]);
  const heroRingAlpha = Number(/rgba\(241, 238, 246, ([\d.]+)\)/.exec(teamCSS)?.[1]);
  const heroShineAlpha = Number(/rgba\(239, 214, 245, ([\d.]+)\)/.exec(teamCSS)?.[1]);
  const archiveAlpha = Number(/color-mix\(in srgb, var\(--z-action\) (\d+)%/.exec(archiveCSS)?.[1]) / 100;

  it.each(["classic", "summer", "winter", "simple"])("keeps %s stage labels legible across the layered backgrounds", (name) => {
    const p = palettes[name];
    const ink = rgb(p["stage-ink"]), muted = rgb(p["stage-muted"]), accent = rgb(p.accent);
    expect(teamCSS).toMatch(/\.stats strong\s*\{\s*color:\s*var\(--z-stage-ink\)/);
    expect(archiveCSS).toMatch(/\.archiveAward\s*\{\s*color:\s*var\(--z-stage-ink\)/);
    for (const stage of [rgb(p.stage), rgb(p["stage-2"])]) {
      expect(ratio(accent, stage)).toBeGreaterThanOrEqual(4.5);
      const archive = over(rgb(p.action), archiveAlpha, stage);
      expect(ratio(ink, archive)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(muted, archive)).toBeGreaterThanOrEqual(4.5);
      for (let hue = 0; hue < 360; hue += 1) {
        for (const shine of [0, heroShineAlpha]) for (const ring of [0, heroRingAlpha]) for (const plate of [0, 0.06]) {
          const hero = over([255, 255, 255], plate, over([241, 238, 246], ring, over([239, 214, 245], shine, over(hsl(hue), heroAlpha, stage))));
          expect(ratio(ink, hero)).toBeGreaterThanOrEqual(4.5);
          expect(ratio(muted, hero)).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const shine of [0, 0.08]) for (const ring of [0, 0.08]) {
        const account = over([241, 238, 246], ring, over([239, 214, 245], shine, stage));
        expect(ratio(accent, account)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(accent, over([255, 255, 255], 0.06, account))).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("team profile cards on a phone", () => {
  it("wraps synthetic long names, positions and descriptions inside the card", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
      await page.route("**/*", (route) => route.abort());
      const css = source("src/app/(frontend)/tokens.css") + source("src/app/(frontend)/pixel.css") + source("src/app/(frontend)/teams/[slug]/team.module.css");
      const long = "SyntheticLongUnbrokenText".repeat(20);
      await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}.container{padding:16px}${css}</style><div class="container"><ul class="roster"><li class="profile"><span style="width:64px;height:64px"></span><div><h3>${long}</h3><p class="position">${long}</p><p class="bio">${long}</p></div></li></ul><article class="positionPanel"><h3>${long}</h3><dl class="positionFacts"><div><dt>职责</dt><dd>${long}</dd></div></dl></article></div>`);
      for (const width of [320, 360]) {
        await page.setViewportSize({ width, height: 720 });
        for (const palette of ["classic", "summer", "winter", "simple"]) {
          const sizes = await page.evaluate((theme) => {
            document.documentElement.dataset.zPalette = theme;
            const profile = document.querySelector(".profile")! as HTMLElement;
            const position = document.querySelector(".positionPanel")! as HTMLElement;
            const elements = [...profile.querySelectorAll("h3, p"), ...position.querySelectorAll("h3, dd")] as HTMLElement[];
            return { documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, profile: profile.scrollWidth > profile.clientWidth, position: position.scrollWidth > position.clientWidth, elements: elements.map((element) => element.scrollWidth > element.clientWidth), bioHeight: (document.querySelector(".bio") as HTMLElement).offsetHeight };
          }, palette);
          expect(sizes.documentOverflow, `${palette} ${width}`).toBe(false);
          expect(sizes.profile).toBe(false);
          expect(sizes.position).toBe(false);
          expect(sizes.elements).toEqual([false, false, false, false, false]);
          expect(sizes.bioHeight).toBeGreaterThan(40);
        }
      }
    } finally {
      await browser.close();
    }
  });
});
