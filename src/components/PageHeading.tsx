import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./account-pages/AccountPages.module.css";
export function PageHeading({
  title,
  eyebrow,
  description,
  parent,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  description?: string | null;
  parent?: { href: string; label: string };
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        {parent ? (
          <>
            <Link href={parent.href}>{parent.label}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">详情</span>
          </>
        ) : (
          <span aria-current="page">{title}</span>
        )}
      </nav>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <div className={styles.headingRow}>
        <h1>{title}</h1>
        {action}
      </div>
      {description && (
        <p className={styles.headingDescription}>{description}</p>
      )}
      {children && <div className={styles.headingExtra}>{children}</div>}
    </header>
  );
}
