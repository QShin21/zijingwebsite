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
    <section className={styles.page}>
      <p className={styles.eyebrow}>CONNECTION / RETRY</p>
      <h1>内容暂时无法加载</h1>
      <p role="alert">
        请稍后重试。若正在报名，请先查看本人回执确认提交结果，再决定是否重试。
      </p>
      <div className="signup-tools">
        <button type="button" className="button" onClick={reset}>
          重新加载
        </button>
        <Link href="/events">浏览活动</Link>
      </div>
    </section>
  );
}
