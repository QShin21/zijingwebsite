import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero, Wrap } from "./ui";
import styles from "./task.module.css";
import { LabeledOl } from "./LocalText";

/**
 * V2 task layout for retained business flows (sign-up, questionnaires, staff,
 * teams): stage header, optional step rail, main flow and a guidance aside.
 */
export function TaskFrame({
  eyebrow,
  title,
  description,
  back,
  steps,
  current,
  aside,
  actions,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  back?: { href: string; label: string };
  steps?: string[];
  current?: number;
  aside?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <>
      <PageHero tone="stage" eyebrow={eyebrow} title={title} description={description} back={back} actions={actions}>
        {steps && (
          <LabeledOl className={styles.rail} zh="办理步骤" en="Steps">
            {steps.map((step, index) => (
              <li key={step} aria-current={current === index ? "step" : undefined} data-done={current !== undefined && index < current ? "" : undefined}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </LabeledOl>
        )}
      </PageHero>
      <Wrap width={wide ? "max" : "workspace"} className={styles.body}>
        <div className={aside ? styles.grid : undefined}>
          <div className={styles.main}>{children}</div>
          {aside && <aside className={styles.aside}>{aside}</aside>}
        </div>
      </Wrap>
    </>
  );
}

export function TaskNote({ title, children, links }: { title: string; children: ReactNode; links?: { href: string; label: string }[] }) {
  return (
    <section className={styles.note}>
      <h2>{title}</h2>
      <div className={styles.noteBody}>{children}</div>
      {links && links.length > 0 && (
        <p className={styles.noteLinks}>
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}
