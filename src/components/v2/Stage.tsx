import type { ReactNode } from "react";
import { StageCanvas } from "./StageCanvas";
import styles from "./stage.module.css";

/**
 * Dark broadcast stage. The layered light (CSS sweep + client Canvas sparks)
 * is decorative; the content is complete without it.
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
  return (
    <section className={compact ? `${styles.stage} ${styles.compact}` : styles.stage} aria-label={label}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={styles.sweep} />
        <span className={styles.stripes} />
        <span className={styles.floor} />
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
