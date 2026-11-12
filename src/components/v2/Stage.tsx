import type { ReactNode } from "react";
import styles from "./stage.module.css";
import { CampusNews } from "./CampusMotion";

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
    <section
      className={compact ? `${styles.stage} ${styles.compact}` : styles.stage}
      aria-label={label}
    >
      <div className={styles.inner}>
        <div className={styles.copy}>{children}</div>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      {ticker && <div className={styles.ticker}>{ticker}</div>}
    </section>
  );
}

/** Retained specimen API, sharing the same motion guards as the home news strip. */
export function Ticker({
  label,
  items,
}: {
  label: string;
  items: { key: string; text: string }[];
}) {
  return (
    <div aria-label={label}>
      <CampusNews items={items.map((item) => ({ ...item, href: "/events" }))} />
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
