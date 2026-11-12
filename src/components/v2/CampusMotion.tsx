"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FocusEvent,
} from "react";
import { Icon } from "./Icon";
import { PixelCorners } from "./PixelCorners";
import styles from "./campus.module.css";

/** One clock for each visible surface; all automatic motion uses the same stop conditions. */
function useCampusMotion(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const engaged = hovered || focused;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let visible = false;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setRunning(
        visible &&
          !document.hidden &&
          !media.matches &&
          !engaged &&
          document.documentElement.dataset.zTheme !== "simple",
      );
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.15 },
    );
    const theme = new MutationObserver(update);
    observer.observe(node);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-z-theme"],
    });
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      theme.disconnect();
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [engaged]);
  useEffect(() => {
    if (!running || count < 2) return;
    const timer = setInterval(
      () => setIndex((value) => (value + 1) % count),
      6500,
    );
    return () => clearInterval(timer);
  }, [running, count]);
  return {
    ref,
    index,
    running,
    move: (step: number) => setIndex((value) => (value + step + count) % count),
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    },
  };
}

export function CampusCover({
  children,
  customImage,
}: {
  children: ReactNode;
  customImage: boolean;
}) {
  const { ref, running, onMouseEnter, onMouseLeave, onFocus, onBlur } =
    useCampusMotion(0);
  return (
    <div
      ref={ref}
      className={styles.cover}
      data-running={running}
      data-custom={customImage || undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.ambience}>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      {children}
    </div>
  );
}

export type CampusSlide = {
  src: string;
  alt: string;
  title: string;
  href: string;
  source?: string;
};
export function CampusReel({
  slides,
  title = "赛场瞬间",
  showCaption = true,
}: {
  slides: CampusSlide[];
  title?: string;
  showCaption?: boolean;
}) {
  const { ref, index, running, move, ...events } = useCampusMotion(
    slides.length,
  );
  const slide = slides[index];
  const [failed, setFailed] = useState<string[]>([]);
  if (!slide) return null;
  return (
    <div
      ref={ref}
      {...events}
      className={styles.reel}
      data-running={running}
      data-caption={showCaption}
      role="region"
      aria-label={title}
      aria-roledescription="轮播"
    >
      <PixelCorners variant="mint" />
      <div className={styles.reelHead}>
        <h2>{title}</h2>
        <div className={styles.controls}>
          <span aria-label={`第 ${index + 1} 张，共 ${slides.length} 张`}>
            {index + 1} / {slides.length}
          </span>
          {slides.length > 1 && (
            <>
              <button
                type="button"
                aria-label="上一张赛场照片"
                onClick={() => move(-1)}
              >
                <Icon name="back" size={18} />
              </button>
              <button
                type="button"
                aria-label="下一张赛场照片"
                onClick={() => move(1)}
              >
                <Icon name="arrow" size={18} />
              </button>
            </>
          )}
        </div>
      </div>
      <Link href={slide.href} className={styles.photo} aria-label={slide.title}>
        {!failed.includes(slide.src) ? (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            loading="lazy"
            width="600"
            height="400"
            onError={() => setFailed((items) => [...items, slide.src])}
          />
        ) : (
          <span className={styles.photoFallback}>
            <Icon name="image" size={36} />
            图片暂时无法显示，点击查看记录
          </span>
        )}
      </Link>
      {showCaption && (
        <div className={styles.reelCaption}>
          <Link href={slide.href}>
            {slide.title}
            <Icon name="arrow" size={16} />
          </Link>
          {slide.source && (
            <a href={slide.source} target="_blank" rel="noopener noreferrer">
              赛事摄影来源
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function CampusNews({
  items,
}: {
  items: { key: string; text: string; href: string }[];
}) {
  const { ref, index, running, move, ...events } = useCampusMotion(
    items.length,
  );
  const item = items[index];
  if (!item) return null;
  return (
    <div
      ref={ref}
      {...events}
      className={styles.news}
      data-running={running}
      aria-label="校园消息"
    >
      <span className={styles.newsLabel}>
        <Icon name="bell" size={19} />
        校园消息
      </span>
      <Link key={item.key} href={item.href} className={styles.newsItem}>
        {item.text}
      </Link>
      {items.length > 1 && (
        <div className={styles.controls}>
          <span>
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            aria-label="上一条校园消息"
            onClick={() => move(-1)}
          >
            <Icon name="back" size={18} />
          </button>
          <button
            type="button"
            aria-label="下一条校园消息"
            onClick={() => move(1)}
          >
            <Icon name="arrow" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Sample the original app emblem into twelve coarse cells per side. */
export function PixelGameIcon({ src }: { src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const source = image.current;
    if (!source) return;
    const paint = () => {
      const context = canvas.current?.getContext("2d");
      if (!context || !source.naturalWidth) return;
      context.drawImage(source, 0, 0, 12, 12);
      const pixels = context.getImageData(0, 0, 12, 12);
      for (let i = 0; i < pixels.data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++)
          pixels.data[i + channel] =
            Math.round(pixels.data[i + channel] / 48) * 48;
      }
      context.putImageData(pixels, 0, 0);
      setReady(true);
    };
    // Cached images can finish before hydration attaches an onLoad handler.
    if (source.complete) paint();
    source.addEventListener("load", paint);
    return () => source.removeEventListener("load", paint);
  }, [src]);
  return (
    <span className={styles.iconArt} data-ready={ready || undefined}>
      <canvas ref={canvas} width="12" height="12" aria-hidden="true" />
      <img
        ref={image}
        className={styles.gameIcon}
        src={src}
        width="72"
        height="72"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
