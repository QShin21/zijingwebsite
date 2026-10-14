import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./TeamPages.module.css";

export function TeamTaskNav({
  items,
  label = "本页任务",
}: {
  items: { href: string; label: string; current?: boolean }[];
  label?: string;
}) {
  return (
    <nav className={styles.taskNav} aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function TeamSectionHeading({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.sectionHead}>
      <h2 id={id}>{title}</h2>
      {children && <p>{children}</p>}
    </header>
  );
}

export function TeamEmpty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
