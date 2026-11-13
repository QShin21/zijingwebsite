import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = "miniprogram/src/";
const read = (path: string) => readFileSync(root + path, "utf8");
type Definition = {
  properties: Record<string, { value: unknown; observer?: () => void }>;
  data: Record<string, unknown>;
  lifetimes: Record<string, () => void>;
  pageLifetimes: Record<string, () => void>;
  methods: Record<string, () => void>;
};

/** Runs the real component definition with a minimal native instance. */
function mount(scene: string) {
  let definition: Definition | null = null;
  vi.stubGlobal("Component", (value: Definition) => { definition = value; });
  const require = createRequire(import.meta.url);
  const file = require.resolve("../" + root + "components/zj-campus/index.js");
  delete require.cache[file];
  require(file);
  const spec = definition as unknown as Definition;
  const observer = { callback: null as null | ((result: { intersectionRatio: number }) => void), disconnected: 0, created: 0 };
  const updates: Record<string, unknown>[] = [];
  const instance: Record<string, unknown> = {
    ...spec.methods,
    properties: { scene, palette: "light", variant: "home" },
    data: { ...spec.data },
    setData(patch: Record<string, unknown>) { updates.push(patch); Object.assign(this.data as object, patch); },
    createIntersectionObserver: () => (observer.created++, {
      relativeToViewport() { return this; },
      observe(_selector: string, callback: (result: { intersectionRatio: number }) => void) { observer.callback = callback; },
      disconnect() { observer.disconnected++; },
    }),
  };
  const call = (group: "lifetimes" | "pageLifetimes" | "methods", name: string) => spec[group][name].call(instance);
  call("lifetimes", "attached");
  call("lifetimes", "ready");
  return { spec, instance, data: instance.data as Record<string, unknown>, observer, updates, call };
}

afterEach(() => vi.unstubAllGlobals());

describe("zj-campus scenery component", () => {
  it("shows the bundled illustration, falls back to JPEG once, then to the drawn sky", () => {
    const c = mount("/assets/tsinghua-auditorium-snow.webp");
    expect(c.data).toMatchObject({ src: "/assets/tsinghua-auditorium-snow.webp", fallback: false, loaded: false });
    c.call("methods", "failed");
    expect(c.data).toMatchObject({ src: "/assets/tsinghua-auditorium-snow.jpg", fallback: false });
    c.call("methods", "shown");
    expect(c.data.loaded).toBe(true);
    c.call("methods", "failed");
    expect(c.data).toMatchObject({ src: "", fallback: true, loaded: false });
    // A later palette change starts again from the new illustration.
    (c.instance.properties as Record<string, string>).scene = "/assets/tsinghua-second-gate.webp";
    c.spec.properties.scene.observer!.call(c.instance);
    expect(c.data).toMatchObject({ src: "/assets/tsinghua-second-gate.webp", fallback: false });
  });
  it("renders nothing for the 简约 palette (empty scene)", () => {
    const c = mount("");
    expect(c.data).toMatchObject({ src: "", fallback: false });
    const markup = read("components/zj-campus/index.wxml");
    expect(markup).toMatch(/<view id="zj-campus"[^>]*>\s*<block wx:if="\{\{src \|\| fallback\}\}">/);
    expect(markup.match(/id="zj-campus"/g)).toHaveLength(1);
  });
  it("keeps one observer through 简约 → scenic → 简约 and still pauses and resumes", () => {
    const c = mount("");
    expect(c.observer.callback).not.toBeNull();
    const scene = (value: string) => { (c.instance.properties as Record<string, string>).scene = value; c.spec.properties.scene.observer!.call(c.instance); };
    scene("/assets/tsinghua-second-gate.webp");
    expect(c.data).toMatchObject({ src: "/assets/tsinghua-second-gate.webp", paused: false });
    c.observer.callback!({ intersectionRatio: 0 });
    expect(c.data.paused).toBe(true);
    scene("");
    expect(c.data).toMatchObject({ src: "", fallback: false, paused: true });
    scene("/assets/tsinghua-lotus-pond.webp");
    c.observer.callback!({ intersectionRatio: 1 });
    expect(c.data).toMatchObject({ src: "/assets/tsinghua-lotus-pond.webp", paused: false });
    c.call("pageLifetimes", "hide");
    expect(c.data.paused).toBe(true);
    c.call("lifetimes", "detached");
    expect(c.observer.disconnected).toBe(1);
    expect(c.observer.created).toBe(1);
  });
  it("pauses while the page is hidden or the scenery is off screen and cleans up when detached", () => {
    const c = mount("/assets/tsinghua-lotus-pond.webp");
    expect(c.data.paused).toBe(false);
    c.call("pageLifetimes", "hide");
    expect(c.data.paused).toBe(true);
    c.call("pageLifetimes", "show");
    expect(c.data.paused).toBe(false);
    c.observer.callback!({ intersectionRatio: 0 });
    expect(c.data.paused).toBe(true);
    c.call("pageLifetimes", "hide");
    c.call("pageLifetimes", "show");
    expect(c.data.paused).toBe(true);
    c.observer.callback!({ intersectionRatio: 0.4 });
    expect(c.data.paused).toBe(false);
    const before = c.updates.length;
    c.observer.callback!({ intersectionRatio: 0.9 });
    expect(c.updates.length).toBe(before);
    c.call("lifetimes", "detached");
    expect(c.observer.disconnected).toBe(1);
  });
  it("uses no timers, canvas, storage or network", () => {
    const source = read("components/zj-campus/index.js").replace(/\/\/.*$|\/\*[^]*?\*\//gm, "");
    expect(source).not.toMatch(/wx\.|setInterval|setTimeout|requestAnimationFrame|canvas|http/i);
    const css = read("components/zj-campus/index.wxss");
    expect(css).toMatch(/\.campus-paused [^{]*\{ animation-play-state: paused; \}/);
    expect(css).toMatch(/\.campus \{[^}]*pointer-events: none;/);
    expect(css).toMatch(/:host \{[^}]*position: absolute;[^}]*z-index: 0;[^}]*pointer-events: none;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*animation: none;/);
    expect(css).toContain(".campus-moon");
  });
});

describe("campus scenery placement and assets", () => {
  it("sits inside the stage on home and in the headings of the tab pages", () => {
    const home = read("pages/home/index.wxml");
    expect(home).toMatch(/<view class="zj-stage home-stage[^>]*>\s*<zj-campus scene="\{\{scene\}\}" palette="\{\{palette\}\}" variant="home" \/>/);
    expect(home).not.toContain("home-campus-art");
    for (const page of ["events", "communities", "teams", "recruitment", "account"])
      expect(read(`pages/${page}/index.wxml`), page).toContain('<zj-campus scene="{{scene}}" palette="{{palette}}" />');
    expect(JSON.parse(read("app.json")).usingComponents).toEqual({ "zj-campus": "/components/zj-campus/index" });
    expect(read("app.wxss")).toMatch(/\.page-heading > text, \.page-heading > view, \.page-heading > button \{ position: relative; z-index: 1; \}/);
    // Content layers sit above the scenery host (z-index 0).
    expect(read("templates/v2.wxss")).toMatch(/\.zj-stage-content \{ position: relative; z-index: 2; \}/);
    expect(read("pages/account/index.wxss")).toMatch(/\.account-card-inner \{ position: relative; z-index: 2; \}/);
  });
  it("bundles each landmark as WebP with a small JPEG copy", () => {
    for (const name of ["second-gate", "lotus-pond", "auditorium-snow"]) {
      for (const extension of ["webp", "jpg"]) expect(existsSync(`${root}assets/tsinghua-${name}.${extension}`)).toBe(true);
      expect(statSync(`${root}assets/tsinghua-${name}.jpg`).size).toBeLessThan(60_000);
    }
  });
});
