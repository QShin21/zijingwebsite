"use client";
import { useEffect, useRef } from "react";

/**
 * Decorative stage light field rendered entirely in the visitor's browser.
 * - Canvas 2D, additive light dust following the arena shafts, gently pointer-reactive.
 * - Pauses when off-screen (IntersectionObserver) or the tab is hidden.
 * - prefers-reduced-motion: one static frame, no animation loop.
 * - No network requests; content and flows never depend on it.
 */
type Spark = { x: number; y: number; vx: number; vy: number; r: number; lime: boolean; phase: number; depth: number };

export function StageCanvas({ className, density = 1 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !host || !context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      frame = 0,
      running = false,
      onScreen = true,
      last = 0;
    let sparks: Spark[] = [];
    const pointer = { x: -9999, y: -9999, strength: 0 };

    // 黑曜竞技场 light dust: sparse motes drifting through the arena's light shafts,
    // a few slow gold embers rising from the floor. No network lines, no glow orbs.
    const seed = () => {
      const count = Math.round(Math.min(140, Math.max(40, ((width * height) / 14000) * density)));
      sparks = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.35) * 0.08,
        r: 0.5 + Math.random() * 1.4,
        lime: Math.random() < 0.12, // rare gold ember
        phase: Math.random() * Math.PI * 2,
        depth: 0.35 + Math.random() * 0.65,
      }));
    };

    // Brightness follows the shafts painted by ArenaArt (centred around 62% width).
    const shaft = (x: number, y: number) => {
      const centre = width * (0.62 + 0.035 * Math.sin(performance.now() / 7000));
      const spread = width * (0.08 + 0.18 * (y / Math.max(1, height)));
      return Math.max(0.18, Math.exp(-((x - centre) ** 2) / (2 * spread * spread)));
    };

    const draw = (time: number, step: number) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      const t = time / 1000;
      for (const s of sparks) {
        if (step > 0) {
          if (pointer.strength > 0) {
            const dx = s.x - pointer.x,
              dy = s.y - pointer.y,
              distance = Math.hypot(dx, dy);
            if (distance < 120 && distance > 0.1) {
              const push = (1 - distance / 120) * pointer.strength * 0.04;
              s.vx += (dx / distance) * push;
              s.vy += (dy / distance) * push;
            }
          }
          s.vx = s.vx * 0.99 + (Math.random() - 0.5) * 0.002;
          s.vy = s.lime ? s.vy * 0.99 - 0.0012 : s.vy * 0.99 + (Math.random() - 0.5) * 0.002;
          s.x += s.vx * step * s.depth;
          s.y += s.vy * step * s.depth;
          if (s.y < -10) {
            s.y = height + 10;
            s.x = Math.random() * width;
          }
          if (s.y > height + 10) s.y = -10;
          if (s.x < -10) s.x = width + 10;
          if (s.x > width + 10) s.x = -10;
        }
        const shimmer = 0.6 + 0.4 * Math.sin(t * 0.9 + s.phase);
        const alpha = (s.lime ? 0.7 : 0.55) * shimmer * shaft(s.x, s.y) * s.depth;
        context.fillStyle = s.lime ? `rgba(240, 192, 96, ${alpha})` : `rgba(239, 214, 245, ${alpha})`;
        context.beginPath();
        context.arc(s.x, s.y, s.r * (0.6 + s.depth * 0.6), 0, Math.PI * 2);
        context.fill();
      }
      context.globalCompositeOperation = "source-over";
    };

    const loop = (time: number) => {
      const step = last ? Math.min(3, (time - last) / 16.67) : 1;
      last = time;
      pointer.strength *= 0.985;
      draw(time, step);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || motion.matches || !onScreen || document.hidden) return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
      if (!running) draw(performance.now(), 0);
    };
    const move = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.strength = 1;
    };
    const leave = () => {
      pointer.strength = 0;
    };
    const visibility = () => (document.hidden ? stop() : start());
    const motionChange = () => {
      if (motion.matches) {
        stop();
        draw(performance.now(), 0);
      } else start();
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(host);
    const viewObserver = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { rootMargin: "80px" },
    );
    viewObserver.observe(host);
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", motionChange);
    resize();
    start();
    canvas.dataset.ready = "true";
    return () => {
      stop();
      sizeObserver.disconnect();
      viewObserver.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", motionChange);
    };
  }, [density]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
