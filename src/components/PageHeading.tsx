import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PageHeading.module.css";

/**
 * V2 inner-page header (broadcast band). Same props as the previous heading so
 * workbench and form pages adopt the new frame without touching their logic.
 */
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
      <div className={styles.inner}>
        <nav className={styles.breadcrumbs} aria-label="面包屑">
          <Link href="/">主场</Link>
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
        <div className={styles.headingRow}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            {description && <p className={styles.headingDescription}>{description}</p>}
          </div>
          {action && <div className={styles.action}>{action}</div>}
        </div>
        {children && <div className={styles.headingExtra}>{children}</div>}
      </div>
    </header>
  );
}
