"use client";
import { useEffect } from "react";

/**
 * Pointer light for card plates (2026-11-13). One passive, frame-throttled listener writes the
 * pointer position (--gx/--gy, px inside the card) on the hovered <article>; card CSS paints a
 * soft accent light there. Fine pointers only; skipped for reduced motion and the 简约 palette.
 * No data access and no network.
 */
export function ClientEffects() {
  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0, lit: HTMLElement | null = null;
    const clear = () => { lit?.style.removeProperty("--gx"); lit?.style.removeProperty("--gy"); lit = null; };
    const move = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const card = document.documentElement.dataset.zPalette === "simple" ? null : (event.target as Element | null)?.closest?.<HTMLElement>("main article");
        if (card !== lit) clear();
        if (!card) return;
        const box = card.getBoundingClientRect();
        card.style.setProperty("--gx", `${Math.round(event.clientX - box.left)}px`);
        card.style.setProperty("--gy", `${Math.round(event.clientY - box.top)}px`);
        lit = card;
      });
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", clear);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", clear);
      if (frame) cancelAnimationFrame(frame);
      clear();
    };
  }, []);
  return null;
}
