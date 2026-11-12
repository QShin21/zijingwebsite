"use client";
import { useEffect, useRef } from "react";

/**
 * Decorative stage light field rendered entirely in the visitor's browser.
 * - Canvas 2D, additive sparks + constellation lines, pointer-reactive.
 * - Pauses when off-screen (IntersectionObserver) or the tab is hidden.
 * - prefers-reduced-motion: one static frame, no animation loop.
 * - No network requests; content and flows never depend on it.
 */
type Spark = { x: number; y: number; vx: number; vy: number; r: number; lime: boolean; phase: number };

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

    const seed = () => {
      const count = Math.round(Math.min(220, Math.max(70, ((width * height) / 8200) * density)));
      sparks = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: -(0.06 + Math.random() * 0.26),
        r: 0.6 + Math.random() * 1.9,
        lime: Math.random() < 0.26,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (time: number, step: number) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      // Slow moving spotlight (Lissajous path).
      const t = time / 1000;
      const sx = width * (0.62 + 0.26 * Math.sin(t * 0.21));
      const sy = height * (0.38 + 0.22 * Math.cos(t * 0.17));
      const radius = Math.max(width, height) * 0.55;
      const light = context.createRadialGradient(sx, sy, 0, sx, sy, radius);
      light.addColorStop(0, "rgba(140, 104, 255, 0.22)");
      light.addColorStop(0.45, "rgba(90, 43, 230, 0.08)");
      light.addColorStop(1, "rgba(90, 43, 230, 0)");
      context.fillStyle = light;
      context.fillRect(0, 0, width, height);

      const reach = 150,
        link = 92;
      for (const s of sparks) {
        if (step > 0) {
          const dx = s.x - pointer.x,
            dy = s.y - pointer.y,
            distance = Math.hypot(dx, dy);
          if (pointer.strength > 0 && distance < reach && distance > 0.1) {
            const push = (1 - distance / reach) * 0.9 * pointer.strength;
            s.vx += (dx / distance) * push * 0.08;
            s.vy += (dy / distance) * push * 0.08;
          }
          s.vx = s.vx * 0.985 + (Math.random() - 0.5) * 0.004;
          s.vy = s.vy * 0.985 - 0.0022;
          s.x += s.vx * step;
          s.y += s.vy * step;
          if (s.y < -10) {
            s.y = height + 10;
            s.x = Math.random() * width;
            s.vy = -(0.06 + Math.random() * 0.26);
          }
          if (s.x < -10) s.x = width + 10;
          if (s.x > width + 10) s.x = -10;
        }
        const twinkle = 0.55 + 0.45 * Math.sin(t * 1.6 + s.phase);
        context.fillStyle = s.lime ? `rgba(197, 240, 74, ${0.55 * twinkle})` : `rgba(190, 172, 255, ${0.6 * twinkle})`;
        context.beginPath();
        context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        context.fill();
      }
      context.lineWidth = 0.7;
      for (let i = 0; i < sparks.length; i++) {
        const a = sparks[i];
        for (let j = i + 1; j < sparks.length; j++) {
          const b = sparks[j],
            dx = a.x - b.x,
            dy = a.y - b.y;
          if (Math.abs(dx) > link || Math.abs(dy) > link) continue;
          const d = Math.hypot(dx, dy);
          if (d < link) {
            context.strokeStyle = `rgba(165, 140, 255, ${0.16 * (1 - d / link)})`;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
        if (pointer.strength > 0) {
          const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          if (d < reach) {
            context.strokeStyle = `rgba(197, 240, 74, ${0.35 * (1 - d / reach) * pointer.strength})`;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(pointer.x, pointer.y);
            context.stroke();
          }
        }
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
