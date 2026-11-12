"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import type { ImageRef, PublicationPresentation as Presentation } from "@/lib/v2/types";
import styles from "./publication-presentation.module.css";

export function PublicationPresentation({ presentation, images, text }: { presentation: Presentation; images: ImageRef[]; text?: string | null }) {
  const [index, setIndex] = useState(0);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const start = useRef<number | null>(null);
  if (presentation.mode === "article") return <div className={styles.article}>
    {presentation.blocks.map((block, position) => block.type === "text"
      ? <p key={position}>{block.text}</p>
      : <figure key={position}><img src={block.image.src} alt={block.image.alt || "文章配图"} loading="lazy" /></figure>)}
  </div>;
  const current = Math.min(index, images.length - 1);
  return <div className={styles.galleryLayout}>
    {images.length > 0 && <div className={styles.gallery} onTouchStart={event => { start.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={event => { const end = event.changedTouches[0]?.clientX; if (start.current != null && end != null && Math.abs(end - start.current) > 45) setIndex(value => Math.max(0, Math.min(images.length - 1, value + (end < start.current! ? 1 : -1)))); start.current = null; }}>
      <figure><img src={images[current].src} alt={images[current].alt || `第 ${current + 1} 张图片`} /></figure>
      {images.length > 1 && <>
        <div className={styles.controls}>
          <button type="button" disabled={!ready || current === 0} onClick={() => setIndex(current - 1)} aria-label="上一张图片">‹</button>
          <span aria-live="polite">{current + 1} / {images.length}</span>
          <button type="button" disabled={!ready || current === images.length - 1} onClick={() => setIndex(current + 1)} aria-label="下一张图片">›</button>
        </div>
        <div className={styles.thumbnails} aria-label="选择图片">{images.map((image, position) =>
          <button type="button" key={`${image.src}-${position}`} disabled={!ready} onClick={() => setIndex(position)} aria-label={`查看第 ${position + 1} 张图片`} aria-current={position === current ? "true" : undefined}>
            <img src={image.src} alt="" loading="lazy" />
          </button>)}</div>
      </>}
    </div>}
    {text && <p className={styles.text}>{text}</p>}
  </div>;
}
