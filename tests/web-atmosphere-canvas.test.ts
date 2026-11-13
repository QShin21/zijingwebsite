import { afterEach, describe, expect, it, vi } from "vitest";

// Runs the real AtmosphereCanvas effect against stubbed browser APIs (no DOM library):
// start, draw, pause off screen / in the background / reduced motion, and cleanup.
let effect: (() => void | (() => void)) | null = null;
const canvas = { current: null as unknown };
vi.mock("react", () => ({
  useRef: () => canvas,
  useEffect: (run: () => void | (() => void)) => { effect = run; },
}));

function setup(options: { reduce?: boolean; palette?: string } = {}) {
  const calls = { fillRect: 0, clearRect: 0, stroke: 0 };
  const context = {
    setTransform() {}, clearRect() { calls.clearRect++; }, fillRect() { calls.fillRect++; },
    createRadialGradient: () => ({ addColorStop() {} }),
    setLineDash() {}, beginPath() {}, arc() {}, stroke() { calls.stroke++; },
    imageSmoothingEnabled: true, globalAlpha: 1, globalCompositeOperation: "source-over", fillStyle: "",
  };
  canvas.current = { getContext: () => context, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }), width: 0, height: 0 };
  const frames = new Map<number, (time: number) => void>();
  let nextFrame = 1;
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const target = {
    addEventListener(type: string, fn: (event: unknown) => void) { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn); },
    removeEventListener(type: string, fn: (event: unknown) => void) { listeners.get(type)?.delete(fn); },
  };
  const documentStub = { ...target, hidden: false, documentElement: { dataset: { zPalette: options.palette ?? "classic" } as Record<string, string> } };
  const observers = { intersect: null as null | ((entries: { isIntersecting: boolean }[]) => void), disconnected: 0 };
  class Observer { observe() {} disconnect() { observers.disconnected++; } }
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("window", { ...target, devicePixelRatio: 2 });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") ? Boolean(options.reduce) : true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("requestAnimationFrame", (fn: (time: number) => void) => { frames.set(nextFrame, fn); return nextFrame++; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
  vi.stubGlobal("IntersectionObserver", class extends Observer { constructor(fn: (entries: { isIntersecting: boolean }[]) => void) { super(); observers.intersect = fn; } });
  vi.stubGlobal("MutationObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  const tick = (time: number) => { const pending = [...frames.entries()]; frames.clear(); pending.forEach(([, fn]) => fn(time)); };
  const emit = (type: string, event: unknown = {}) => listeners.get(type)?.forEach((fn) => fn(event));
  return { calls, frames, listeners, documentStub, observers, tick, emit };
}

async function mount() {
  const { AtmosphereCanvas } = await import("@/components/v2/AtmosphereCanvas");
  AtmosphereCanvas({});
  return effect!();
}

afterEach(() => { vi.unstubAllGlobals(); effect = null; });

describe("AtmosphereCanvas effect", () => {
  it("starts only when visible, draws particles, removes spent sparks and stops off screen or in the background", async () => {
    const env = setup();
    const cleanup = await mount();
    expect(env.frames.size).toBe(0);
    env.observers.intersect!([{ isIntersecting: true }]);
    expect(env.frames.size).toBe(1);
    env.tick(16); env.tick(32);
    expect(env.calls.fillRect).toBeGreaterThan(20);
    const ambient = env.calls.fillRect;
    env.emit("pointermove", { pointerType: "mouse", clientX: 300, clientY: 200 });
    env.emit("pointerdown", { clientX: 300, clientY: 200 });
    env.calls.fillRect = 0; env.tick(48);
    const withSparks = env.calls.fillRect;
    expect(env.calls.stroke).toBeGreaterThan(0);
    // Both the click ring and its sparks expire after the animation has played.
    for (let time = 64; time < 2200; time += 40) env.tick(time);
    env.calls.fillRect = 0; env.calls.stroke = 0; env.tick(2240);
    expect(withSparks).toBeGreaterThan(env.calls.fillRect);
    expect(env.calls.stroke).toBe(0);
    expect(ambient).toBeGreaterThan(0);
    env.documentStub.hidden = true; env.emit("visibilitychange");
    expect(env.frames.size).toBe(0);
    env.documentStub.hidden = false; env.emit("visibilitychange");
    expect(env.frames.size).toBe(1);
    env.observers.intersect!([{ isIntersecting: false }]);
    expect(env.frames.size).toBe(0);
    (cleanup as () => void)();
    expect(env.observers.disconnected).toBe(3);
    for (const [, set] of env.listeners) expect(set.size).toBe(0);
  });
  it("never starts under reduced motion or the 简约 palette", async () => {
    for (const options of [{ reduce: true }, { palette: "simple" }]) {
      const env = setup(options);
      const cleanup = await mount();
      env.observers.intersect!([{ isIntersecting: true }]);
      expect(env.frames.size).toBe(0);
      expect(env.calls.fillRect).toBe(0);
      (cleanup as () => void)();
    }
  });
  it("keeps repeated clicks bounded and discards their effects when the scene leaves view", async () => {
    const env = setup();
    const cleanup = await mount();
    env.observers.intersect!([{ isIntersecting: true }]);
    env.tick(16);
    for (let index = 0; index < 100; index++) env.emit("pointerdown", { pointerType: "mouse", clientX: 300, clientY: 200 });
    env.calls.fillRect = 0; env.calls.stroke = 0; env.tick(32);
    expect(env.calls.stroke).toBeGreaterThan(0);
    expect(env.calls.stroke).toBeLessThanOrEqual(4);
    expect(env.calls.fillRect).toBeLessThanOrEqual(600);
    env.observers.intersect!([{ isIntersecting: false }]);
    env.observers.intersect!([{ isIntersecting: true }]);
    env.calls.stroke = 0; env.tick(48);
    expect(env.calls.stroke).toBe(0);
    (cleanup as () => void)();
  });
});
