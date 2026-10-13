import type { ReactNode } from "react";
import styles from "./ClubPages.module.css";

/** Page-local presentation for community, team and honor routes only. */
export function ClubFrame({
  children,
  active = true,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return active ? (
    <div className={`${styles.page} ${className}`}>{children}</div>
  ) : (
    <>{children}</>
  );
}

export function ClubSteps({
  label,
  steps,
}: {
  label: string;
  steps: { title: string; description: string }[];
}) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.title}>
          <span className={styles.stepNumber} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
