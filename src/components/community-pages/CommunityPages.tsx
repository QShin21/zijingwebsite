import type { ReactNode } from "react";
import styles from "./CommunityPages.module.css";

export function CommunityPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function CommunityEmpty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function CommunitySectionHeading({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.sectionHead}>
      <h2 id={id}>{title}</h2>
      {children}
    </div>
  );
}
