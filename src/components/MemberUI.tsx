import type { ReactNode } from "react";
import { BrandMark } from "./Identity";
import styles from "./account-pages/AccountPages.module.css";

export function MemberLayout({
  title,
  description,
  steps,
  children,
}: {
  title: string;
  description: string;
  steps: string[];
  children: ReactNode;
}) {
  return (
    <div className={styles.authLayout}>
      <aside className={styles.authIntro}>
        <BrandMark />
        <h2>{title}</h2>
        <p>{description}</p>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <div>{step}</div>
            </li>
          ))}
        </ol>
        <div className={styles.authNotice}>
          网站账号用于记录报名与申请。加入微信群仍需联系社群管理员，人工添加好友并邀请进群。
        </div>
      </aside>
      <section className={styles.authPanel}>{children}</section>
    </div>
  );
}

export function FormStep({ number, title }: { number: string; title: string }) {
  return (
    <h2 className={styles.formHeading}>
      <span>{number}</span>
      {title}
    </h2>
  );
}
