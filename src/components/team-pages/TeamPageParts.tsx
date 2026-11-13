import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import styles from "./TeamPages.module.css";

export async function TeamTaskNav({
  items,
  label,
}: {
  items: { href: string; label: string; current?: boolean }[];
  label?: string;
}) {
  const { t } = await getT();
  return (
    <nav className={styles.taskNav} aria-label={label ?? t("本页任务", "On this page")}>
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
