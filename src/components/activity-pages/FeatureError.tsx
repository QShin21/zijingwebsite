"use client";
import Link from "next/link";
import styles from "./ActivityPages.module.css";
export default function FeatureError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className={`${styles.page} ${styles.errorState}`}>
      <h1>内容暂时无法加载</h1>
      <p role="alert">
        请重新加载后继续。如果刚才提交过报名或申请，先到本人回执核对实际结果。
      </p>
      <div className="signup-tools">
        <button type="button" className="button" onClick={reset}>
          重新加载
        </button>
        <Link className={styles.textAction} href="/account">
          查看我的事务与回执
        </Link>
        <Link className={styles.textAction} href="/events">
          返回活动
        </Link>
      </div>
    </section>
  );
}
