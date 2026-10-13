"use client";
import Link from "next/link";
import styles from "@/components/account-pages/AccountPages.module.css";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className={styles.error}>
      <p className={styles.eyebrow}>页面暂时无法显示</p>
      <h1>内容未能载入</h1>
      <p>
        请重试，或先查看社团活动。如果刚刚提交过报名或申请，请到本人记录中核对实际结果。
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>
          重新加载
        </button>
        <Link className={styles.secondary} href="/account">
          查看本人记录
        </Link>
        <Link className={styles.textLink} href="/events">
          浏览活动
        </Link>
      </div>
    </section>
  );
}
