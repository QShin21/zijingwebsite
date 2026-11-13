"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import type { ImageRef, PublicationPresentation as Presentation } from "@/lib/v2/types";
import styles from "./publication-presentation.module.css";
import { useT } from "@/components/i18n/LocaleProvider";

export function PublicationPresentation({ presentation, images, text }: { presentation: Presentation; images: ImageRef[]; text?: string | null }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const start = useRef<number | null>(null);
  if (presentation.mode === "article") return <div className={styles.article}>
    {presentation.blocks.map((block, position) => block.type === "text"
      ? <p key={position}>{block.text}</p>
      : <figure key={position}><img src={block.image.src} alt={block.image.alt || t("文章配图", "Article image")} loading="lazy" /></figure>)}
  </div>;
  const current = Math.min(index, images.length - 1);
  return <div className={images.length > 0 ? `${styles.galleryLayout} ${styles.galleryLayoutWithImages}` : styles.galleryLayout}>
    {images.length > 0 && <div className={styles.gallery} onTouchStart={event => { start.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={event => { const end = event.changedTouches[0]?.clientX; if (start.current != null && end != null && Math.abs(end - start.current) > 45) setIndex(value => Math.max(0, Math.min(images.length - 1, value + (end < start.current! ? 1 : -1)))); start.current = null; }}>
      <figure><img src={images[current].src} alt={images[current].alt || t(`第 ${current + 1} 张图片`, `Image ${current + 1}`)} /></figure>
      {images.length > 1 && <>
        <div className={styles.controls}>
          <button type="button" disabled={!ready || current === 0} onClick={() => setIndex(current - 1)} aria-label={t("上一张图片", "Previous image")}>‹</button>
          <span aria-live="polite">{current + 1} / {images.length}</span>
          <button type="button" disabled={!ready || current === images.length - 1} onClick={() => setIndex(current + 1)} aria-label={t("下一张图片", "Next image")}>›</button>
        </div>
        <div className={styles.thumbnails} aria-label={t("选择图片", "Choose an image")}>{images.map((image, position) =>
          <button type="button" key={`${image.src}-${position}`} disabled={!ready} onClick={() => setIndex(position)} aria-label={t(`查看第 ${position + 1} 张图片`, `View image ${position + 1}`)} aria-current={position === current ? "true" : undefined}>
            <img src={image.src} alt="" loading="lazy" />
          </button>)}</div>
      </>}
    </div>}
    {text && <p className={styles.text}>{text}</p>}
  </div>;
}
