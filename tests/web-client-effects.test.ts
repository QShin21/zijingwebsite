import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("web client effects stay decorative and browser-only", () => {
  const canvas = read("src/components/v2/AtmosphereCanvas.tsx");
  const light = read("src/components/v2/ClientEffects.tsx");
  it("runs in the browser without data access or network", () => {
    for (const source of [canvas, light]) {
      expect(source.startsWith('"use client";')).toBe(true);
      expect(source).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|setInterval|@\/lib\/|payload/);
    }
  });
  it("pauses off screen and in background tabs, and honours reduced motion and 简约", () => {
    expect(canvas).toContain("IntersectionObserver");
    expect(canvas).toContain("visibilitychange");
    expect(canvas).toContain("prefers-reduced-motion: reduce");
    expect(canvas).toContain('root.dataset.zPalette !== "simple"');
    expect(canvas).toContain("cancelAnimationFrame");
    expect(canvas).toContain('aria-hidden="true"');
    expect(light).toContain("(pointer: fine)");
    expect(light).toContain("prefers-reduced-motion: reduce");
    expect(light).toContain("passive: true");
  });
  it("keeps canvas and bloom out of the way of content and gated in CSS", () => {
    const css = read("src/components/v2/campus.module.css");
    const block = css.slice(css.indexOf("客户端特效 (2026-11-13)"));
    expect(block).toMatch(/\.atmosphere \{[^}]*pointer-events: none;/);
    expect(block).toMatch(/\.bloom \{[^}]*pointer-events: none;/);
    expect(block).toContain('[data-z-palette="simple"]) .atmosphere');
    expect(block).toContain("@media (prefers-reduced-motion: no-preference)");
    const cards = read("src/components/v2/cards.module.css");
    expect(cards.slice(cards.indexOf("客户端特效 (2026-11-13)"))).toContain("@media (prefers-reduced-motion: no-preference)");
    const shell = read("src/components/v2/Shell.module.css");
    expect(shell.slice(shell.indexOf("客户端特效 (2026-11-13)"))).toMatch(/\.bar::after \{[^}]*pointer-events: none;/);
  });
  it("leaves the landmark artwork and server data paths as they were", () => {
    const css = read("src/components/v2/campus.module.css");
    for (const file of ["tsinghua-second-gate.webp", "tsinghua-lotus-pond.webp", "tsinghua-auditorium-snow.webp"]) expect(css).toContain(file);
    expect(read("src/app/(frontend)/layout.tsx")).toContain('export const dynamic = "force-dynamic";');
  });
});

describe("atmosphere particle lifecycle", async () => {
  const { particleFate } = await import("@/components/v2/atmosphere-particles");
  it("removes burst sparks once their life is spent, including when it crosses below zero", () => {
    expect(particleFate({ x: 50, y: 50, life: 0.4, burst: true }, 100, 100)).toBe("keep");
    expect(particleFate({ x: 50, y: 50, life: 0, burst: true }, 100, 100)).toBe("remove");
    expect(particleFate({ x: 50, y: 50, life: -0.03, burst: true }, 100, 100)).toBe("remove");
    expect(particleFate({ x: 500, y: 50, life: 0.4, burst: true }, 100, 100)).toBe("remove");
  });
  it("never removes ambient particles and respawns them only off canvas", () => {
    expect(particleFate({ x: 50, y: 50, life: 0, burst: false }, 100, 100)).toBe("keep");
    expect(particleFate({ x: 50, y: 50, life: -1, burst: false }, 100, 100)).toBe("keep");
    expect(particleFate({ x: 50, y: 120, life: 0, burst: false }, 100, 100)).toBe("respawn");
  });
  it("the canvas decides by the burst flag, not by the sign of life", () => {
    const source = read("src/components/v2/AtmosphereCanvas.tsx");
    expect(source).toContain("particleFate(p, width, height)");
    expect(source).not.toMatch(/p\.life >= 0|p\.life < 0/);
  });
});
