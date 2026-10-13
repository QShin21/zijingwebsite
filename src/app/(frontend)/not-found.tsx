import Link from "next/link";
import styles from "@/components/account-pages/AccountPages.module.css";
export default function NotFound() {
  return (
    <section className={styles.error}>
      <p className={styles.eyebrow}>404 · 页面未找到</p>
      <h1>暂时找不到这一页</h1>
      <p>
        页面可能已调整，或内容尚未公开。请核对链接，也可以从当前栏目重新查找。
      </p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/events">
          查看社团活动
        </Link>
        <Link className={styles.secondary} href="/">
          返回首页
        </Link>
      </div>
    </section>
  );
}
