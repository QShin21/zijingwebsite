import styles from "./ActivityPages.module.css";
export function RouteLoading({ label }: { label: string }) {
  return (
    <section className={styles.page} aria-busy="true">
      <p className={styles.eyebrow}>ZIJING / LOADING</p>
      <h1>正在加载{label}</h1>
      <p role="status">正在获取已发布的内容，请稍候…</p>
      <div className={styles.empty} aria-hidden="true">
        <span>READING THE NEXT MOMENT</span>
      </div>
    </section>
  );
}
