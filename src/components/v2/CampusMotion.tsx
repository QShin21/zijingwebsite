"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent, type ReactNode, type RefObject } from "react";
import { Icon } from "./Icon";
import styles from "./campus.module.css";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const simplePalette = () => document.documentElement.dataset.zPalette === "simple";

/**
 * Environment gate for decorative motion: the element is on screen and the page is visible.
 * Reduced motion and the 简约 palette are handled separately (CSS for scenery, an initial
 * paused state for rotation), so an explicit "play" by the user is still honoured.
 */
function useOnStage(ref: RefObject<HTMLElement | null>) {
  const [onStage, setOnStage] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let visible = false;
    const update = () => setOnStage(visible && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return onStage;
}

/** Scenery wrapper: CSS animations run only while data-motion="run". */
export function MotionScene({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onStage = useOnStage(ref);
  // Pointer depth: writes --mx/--my (−1…1) on the scene; CSS moves layers by different amounts.
  // Fine pointers only, one write per frame, off while hidden, reduced motion or 简约.
  useEffect(() => {
    const scene = ref.current?.closest<HTMLElement>("[data-scene]");
    if (!scene || !onStage || reducedMotion() || simplePalette() || !matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = scene.getBoundingClientRect();
        scene.style.setProperty("--mx", (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
        scene.style.setProperty("--my", (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) cancelAnimationFrame(frame);
      scene.style.removeProperty("--mx");
      scene.style.removeProperty("--my");
    };
  }, [onStage]);
  return (
    <div ref={ref} className={className} data-motion={onStage ? "run" : "pause"} aria-hidden="true">
      {children}
    </div>
  );
}

/** Auto-advance with a user pause, hover/focus hold and environment gate. */
function useRotation(count: number, interval: number) {
  const ref = useRef<HTMLDivElement>(null);
  const onStage = useOnStage(ref);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    // Respect reduced motion and the static palette from the first paint after hydration.
    if (reducedMotion() || simplePalette()) setPaused(true);
    const palette = new MutationObserver(() => {
      if (simplePalette()) setPaused(true);
    });
    palette.observe(document.documentElement, { attributes: true, attributeFilter: ["data-z-palette"] });
    return () => palette.disconnect();
  }, []);
  const running = onStage && !paused && !held && count > 1;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), interval);
    return () => window.clearInterval(timer);
  }, [running, count, interval]);
  return {
    ref,
    index: Math.min(index, Math.max(0, count - 1)),
    paused,
    running,
    setIndex,
    move: (step: number) => setIndex((value) => (value + step + count) % count),
    togglePause: () => setPaused((value) => !value),
    hold: {
      onMouseEnter: () => setHeld(true),
      onMouseLeave: () => setHeld(false),
      onFocus: () => setHeld(true),
      onBlur: (event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      },
    },
  };
}

function PauseButton({ paused, onToggle, subject }: { paused: boolean; onToggle: () => void; subject: string }) {
  return (
    <button type="button" className={styles.control} onClick={onToggle} aria-label={paused ? `继续自动播放${subject}` : `暂停自动播放${subject}`}>
      <Icon name={paused ? "play" : "pause"} size={16} />
    </button>
  );
}

/** "下一场" strip: one upcoming event at a time, every item is a real event link. */
export function NextUpStrip({ items }: { items: { key: string; href: string; text: string }[] }) {
  const rotation = useRotation(items.length, 5000);
  const item = items[rotation.index];
  if (!item) return null;
  return (
    <div ref={rotation.ref} className={styles.nextUp} {...rotation.hold}>
      <span className={styles.nextLabel}>NEXT UP</span>
      <div className={styles.nextViewport} aria-live={rotation.running ? "off" : "polite"}>
        <Link key={item.key} href={item.href} className={styles.nextItem}>
          {item.text}
        </Link>
      </div>
      {items.length > 1 && (
        <div className={styles.controls}>
          <span className={styles.counter}>
            {rotation.index + 1}/{items.length}
          </span>
          <button type="button" className={styles.control} onClick={() => rotation.move(-1)} aria-label="上一场活动">
            <Icon name="back" size={16} />
          </button>
          <PauseButton paused={rotation.paused} onToggle={rotation.togglePause} subject="近期活动" />
          <button type="button" className={styles.control} onClick={() => rotation.move(1)} aria-label="下一场活动">
            <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 赛场高光 carousel. Slides are server-rendered feed cards (same data, links and permissions);
 * only the active one is shown. Manual controls, a pause button and picker dots stay available.
 */
export function HighlightsCarousel({ slides, labels, title }: { slides: ReactNode[]; labels: string[]; title: string }) {
  const rotation = useRotation(slides.length, 6500);
  const regionId = useId();
  if (!slides.length) return null;
  return (
    <div
      ref={rotation.ref}
      className={styles.carousel}
      role="region"
      aria-roledescription="轮播"
      aria-label={title}
      {...rotation.hold}
    >
      <div id={regionId} className={styles.slides} aria-live={rotation.running ? "off" : "polite"}>
        {slides.map((slide, position) => (
          <div
            key={position}
            className={styles.slide}
            role="group"
            aria-roledescription="幻灯片"
            aria-label={`第 ${position + 1} 项，共 ${slides.length} 项：${labels[position] ?? ""}`}
            hidden={position !== rotation.index}
          >
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className={styles.carouselBar}>
          <div className={styles.dots}>
            {slides.map((_, position) => (
              <button
                key={position}
                type="button"
                className={styles.dot}
                aria-controls={regionId}
                aria-current={position === rotation.index ? "true" : undefined}
                aria-label={`查看第 ${position + 1} 项：${labels[position] ?? ""}`}
                onClick={() => rotation.setIndex(position)}
              />
            ))}
          </div>
          <div className={styles.controls}>
            <span className={styles.counter}>
              {rotation.index + 1}/{slides.length}
            </span>
            <button type="button" className={styles.control} aria-controls={regionId} onClick={() => rotation.move(-1)} aria-label="上一项高光">
              <Icon name="back" size={16} />
            </button>
            <PauseButton paused={rotation.paused} onToggle={rotation.togglePause} subject="赛场高光" />
            <button type="button" className={styles.control} aria-controls={regionId} onClick={() => rotation.move(1)} aria-label="下一项高光">
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
