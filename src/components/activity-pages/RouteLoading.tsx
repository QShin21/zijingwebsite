import styles from "../v2/skeleton.module.css";

/** V2 loading state: same silhouette as the final page (stage band + card rows). */
export function RouteLoading({ label }: { label: string }) {
  return (
    <section className={styles.loading} aria-busy="true" aria-labelledby="route-loading-title">
      <div className={styles.band}>
        <div className={styles.bandInner}>
          <span className={styles.kicker} />
          <h1 id="route-loading-title" className={styles.title}>
            正在加载{label}
          </h1>
          <p className={styles.status} role="status">
            正在读取当前内容，请稍候…
          </p>
        </div>
      </div>
      <div className={styles.rows} aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <div className={styles.row} key={row}>
            <span className={styles.date} />
            <span className={styles.lines}>
              <span />
              <span />
              <span />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
