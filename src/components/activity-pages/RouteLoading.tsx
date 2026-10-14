import styles from "./ActivityPages.module.css";
export function RouteLoading({ label }: { label: string }) {
  return (
    <section className={styles.page} aria-busy="true">
      <h1>正在加载{label}</h1>
      <p className={styles.supportText} role="status">
        正在读取当前内容，请稍候…
      </p>
      <div className={styles.loadingRows} aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div className={styles.loadingRow} key={row}>
            <span />
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}
