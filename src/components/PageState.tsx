import type { ReactNode } from "react";
import styles from "./PageState.module.css";

export function PageState({
  label,
  title,
  description,
  children,
  help,
  alert = false,
}: {
  label: string;
  title: string;
  description: string;
  children: ReactNode;
  help: ReactNode;
  alert?: boolean;
}) {
  return (
    <section className={styles.state} aria-labelledby="page-state-title">
      <div className={styles.main}>
        <p className={styles.label}>{label}</p>
        <h1 id="page-state-title">{title}</h1>
        <p className={styles.description} role={alert ? "alert" : undefined}>
          {description}
        </p>
        <div className={styles.actions}>{children}</div>
      </div>
      <aside className={styles.help}>
        <h2>接下来可以做什么</h2>
        {help}
      </aside>
    </section>
  );
}
