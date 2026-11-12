import type { ReactNode } from "react";
import { ArenaArt } from "./ArenaArt";
import { StageCanvas } from "./StageCanvas";
import { artAsset } from "./art";
import styles from "./stage.module.css";

/**
 * 黑曜竞技场 broadcast stage. Layers (back → front): original arena illustration,
 * optional generated arena render (only when the file exists), client-rendered light
 * dust (paused offscreen/hidden, single frame under reduced motion), then content.
 * Every art layer is decorative; content and flows are complete without them.
 */
export function Stage({
  children,
  aside,
  ticker,
  compact = false,
  label,
}: {
  children: ReactNode;
  aside?: ReactNode;
  ticker?: ReactNode;
  compact?: boolean;
  label?: string;
}) {
  const render = artAsset("arena-hero.webp");
  const portrait = artAsset("arena-portrait.webp");
  return (
    <section className={compact ? `${styles.stage} ${styles.compact}` : styles.stage} aria-label={label}>
      <div className={styles.backdrop} aria-hidden="true">
        <ArenaArt className={styles.arena} />
        {render && <span className={styles.render} data-portrait={portrait ? "" : undefined} style={{ backgroundImage: `url(${render})` }} />}
        {portrait && <span className={styles.renderPortrait} style={{ backgroundImage: `url(${portrait})` }} />}
        <span className={styles.grain} />
      </div>
      <StageCanvas className={styles.canvas} />
      <div className={styles.inner}>
        <div className={styles.copy}>{children}</div>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      {ticker && <div className={styles.ticker}>{ticker}</div>}
    </section>
  );
}

/** Broadcast ticker: duplicated track scrolls with CSS; static under reduced motion. */
export function Ticker({ label, items }: { label: string; items: { key: string; text: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className={styles.tickerRow}>
      <span className={styles.tickerLabel}>{label}</span>
      <div className={styles.tickerViewport}>
        <ul className={styles.tickerTrack}>
          {[...items, ...items].map((item, index) => (
            <li key={`${item.key}-${index}`} aria-hidden={index >= items.length ? true : undefined}>
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function StageTitle({ children }: { children: ReactNode }) {
  return <h1 className={styles.title}>{children}</h1>;
}
export function StageKicker({ children }: { children: ReactNode }) {
  return <p className={styles.kicker}>{children}</p>;
}
export function StageLead({ children }: { children: ReactNode }) {
  return <p className={styles.lead}>{children}</p>;
}
export function StageActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
