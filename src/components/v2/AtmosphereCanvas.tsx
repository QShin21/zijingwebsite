"use client";
import { useEffect, useRef } from "react";
import { particleFate, type Particle } from "./atmosphere-particles";

/*
 * Hero atmosphere, drawn in the visitor's browser on one 2D canvas (2026-11-13).
 * Depth-sorted pixel particles per palette: gold dust and ginkgo leaves (清华经典), fireflies with
 * trails (清凉夏夜), wind-blown snow (温煦冬日). A soft lantern light follows a fine pointer and
 * pushes nearby particles; a tap or click releases a small burst. Purely decorative: no data,
 * no requests. Off for 简约 and reduced motion; paused while off screen or in a background tab.
 */
type Palette = "classic" | "summer" | "winter";

const looks: Record<Palette, { colors: string[]; light: string; count: number }> = {
  classic: { colors: ["#ffd98a", "#f6c453", "#ff8fc8", "#fff3cf"], light: "255,214,130", count: 64 },
  summer: { colors: ["#e9ff9a", "#8fe8c9", "#fff3a0", "#c9fff0"], light: "150,240,205", count: 54 },
  winter: { colors: ["#ffffff", "#f1f6ff", "#e3ecf8", "#ffffff"], light: "255,236,190", count: 90 },
};

export function AtmosphereCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const root = document.documentElement;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(pointer: fine)").matches;
    let width = 0, height = 0, frame = 0, last = 0, visible = false, palette: Palette | null = null;
    let particles: Particle[] = [];
    const pointer = { x: -9999, y: -9999, px: 0, wind: 0, strength: 0 };

    const spawn = (anywhere: boolean, burst?: { x: number; y: number }): Particle => {
      const z = 0.35 + Math.random() * 0.65;
      const base: Particle = { x: Math.random() * width, y: Math.random() * height, z, vx: 0, vy: 0, phase: Math.random() * 6.28, kind: Math.random() < 0.18 ? 1 : 0, life: 0, burst: false };
      if (palette === "winter") { base.vy = 18 + z * 46; base.vx = -6 + Math.random() * 12; if (!anywhere) base.y = -6; }
      else if (palette === "classic") { base.vy = base.kind ? 14 + z * 22 : -(4 + z * 10); base.vx = base.kind ? -(10 + z * 16) : (Math.random() - 0.5) * 6; if (!anywhere) base.y = base.kind ? -6 : height + 6; }
      else { base.vx = (Math.random() - 0.5) * 16; base.vy = (Math.random() - 0.5) * 10; base.y = height * (0.35 + Math.random() * 0.6); }
      if (burst) { const angle = Math.random() * 6.28, speed = 40 + Math.random() * 90; base.x = burst.x; base.y = burst.y; base.vx = Math.cos(angle) * speed; base.vy = Math.sin(angle) * speed - 30; base.life = 0.9; base.kind = 2; base.burst = true; }
      return base;
    };
    const seed = () => {
      const value = root.dataset.zPalette;
      palette = value === "classic" || value === "summer" || value === "winter" ? value : null;
      particles = palette ? Array.from({ length: Math.round(looks[palette].count * (fine ? 1 : 0.55) * Math.min(1.4, Math.max(0.5, width / 1100))) }, () => spawn(true)) : [];
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      width = box.width; height = box.height;
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
      seed();
    };
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (time - last) / 1000 || 0.016);
      // Touch devices repaint at ~30 fps to spare the battery.
      if (!fine && time - last < 32) return;
      last = time;
      context.clearRect(0, 0, width, height);
      if (!palette) return;
      const look = looks[palette];
      pointer.wind *= 0.94; pointer.strength *= 0.985;
      if (pointer.strength > 0.02) {
        const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 190);
        glow.addColorStop(0, `rgba(${look.light},${0.2 * pointer.strength})`);
        glow.addColorStop(1, `rgba(${look.light},0)`);
        context.fillStyle = glow;
        context.fillRect(pointer.x - 190, pointer.y - 190, 380, 380);
      }
      context.globalCompositeOperation = palette === "winter" ? "source-over" : "lighter";
      for (let index = particles.length - 1; index >= 0; index--) {
        const p = particles[index];
        const dx = p.x - pointer.x, dy = p.y - pointer.y, distance = dx * dx + dy * dy;
        if (distance < 14400 && pointer.strength > 0.05) { const push = (1 - distance / 14400) * 160 * dt; const d = Math.sqrt(distance) || 1; p.x += (dx / d) * push; p.y += (dy / d) * push; }
        if (palette === "summer" && !p.burst) { p.vx += Math.cos(time / 900 + p.phase) * 14 * dt; p.vy += Math.sin(time / 700 + p.phase * 2) * 10 * dt; p.vx *= 0.99; p.vy *= 0.99; }
        if (p.burst) { p.vy += 120 * dt; p.life -= dt; }
        p.x += (p.vx + pointer.wind * p.z * (palette === "winter" ? 1 : 0.4) + Math.sin(time / 1200 + p.phase) * 6 * p.z) * dt;
        p.y += p.vy * dt;
        const fate = particleFate(p, width, height);
        if (fate === "remove") { particles.splice(index, 1); continue; }
        if (fate === "respawn") { particles[index] = spawn(false); continue; }
        const size = Math.max(2, Math.round((p.kind === 1 ? 5 : 3) * p.z));
        const twinkle = palette === "winter" ? 0.55 + 0.45 * p.z : 0.35 + 0.65 * Math.abs(Math.sin(time / 600 + p.phase));
        context.globalAlpha = (p.burst ? Math.min(1, p.life * 1.6) : twinkle) * (0.5 + 0.5 * p.z);
        context.fillStyle = look.colors[(index + p.kind) % look.colors.length];
        const x = Math.round(p.x), y = Math.round(p.y);
        context.fillRect(x, y, size, size);
        if (palette === "summer" && !p.burst) { context.globalAlpha *= 0.35; context.fillRect(Math.round(x - p.vx * 0.08), Math.round(y - p.vy * 0.08), size, size); context.fillRect(x - size, y - size, size * 3, size * 3); }
        else if (palette === "classic" && p.kind !== 1) { context.globalAlpha *= 0.25; context.fillRect(x - size, y - size, size * 3, size * 3); }
      }
      context.globalAlpha = 1; context.globalCompositeOperation = "source-over";
    };
    const sync = () => {
      const run = visible && !document.hidden && !reduce.matches && root.dataset.zPalette !== "simple";
      if (run && !frame) { last = 0; frame = requestAnimationFrame(draw); }
      if (!run && frame) { cancelAnimationFrame(frame); frame = 0; context.clearRect(0, 0, width, height); }
    };
    const move = (event: PointerEvent) => {
      if (!frame || event.pointerType === "touch") return;
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left, y = event.clientY - box.top;
      if (y < -40 || y > box.height + 40) return;
      pointer.wind = Math.max(-220, Math.min(220, pointer.wind + (x - pointer.px) * 2.4));
      pointer.px = x; pointer.x = x; pointer.y = y; pointer.strength = 1;
    };
    const burst = (event: PointerEvent) => {
      if (!frame || particles.length > 220) return;
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left, y = event.clientY - box.top;
      if (x < 0 || y < 0 || x > box.width || y > box.height) return;
      for (let count = 0; count < 12; count++) particles.push(spawn(true, { x, y }));
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.05 });
    const paletteWatch = new MutationObserver(() => { seed(); sync(); });
    const sizeWatch = new ResizeObserver(resize);
    resize();
    observer.observe(canvas); sizeWatch.observe(canvas);
    paletteWatch.observe(root, { attributes: true, attributeFilter: ["data-z-palette"] });
    document.addEventListener("visibilitychange", sync);
    reduce.addEventListener("change", sync);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", burst, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect(); paletteWatch.disconnect(); sizeWatch.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduce.removeEventListener("change", sync);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", burst);
    };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
