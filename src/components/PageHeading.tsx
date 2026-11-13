import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PageHeading.module.css";
import { LabeledNav, Tr } from "./v2/LocalText";

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
        <LabeledNav className={styles.breadcrumbs} zh="面包屑" en="Breadcrumb">
          <Link href="/">
            <Tr zh="主场" en="Home" />
          </Link>
          <span aria-hidden="true">/</span>
          {parent ? (
            <>
              <Link href={parent.href}>{parent.label}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">
                <Tr zh="详情" en="Details" />
              </span>
            </>
          ) : (
            <span aria-current="page">{title}</span>
          )}
        </LabeledNav>
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
