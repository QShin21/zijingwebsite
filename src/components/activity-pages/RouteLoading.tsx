import styles from "../v2/skeleton.module.css";
import { getT } from "@/lib/i18n/server";

/** V2 loading state: same silhouette as the final page (stage band + card rows). */
/** `label` is already localized by the caller (t("活动", "events")). */
export async function RouteLoading({ label }: { label: string }) {
  const { t } = await getT();
  return (
    <section className={styles.loading} aria-busy="true" aria-labelledby="route-loading-title">
      <div className={styles.band}>
        <div className={styles.bandInner}>
          <span className={styles.kicker} />
          <h1 id="route-loading-title" className={styles.title}>
            {t(`正在加载${label}`, `Loading ${label}…`)}
          </h1>
          <p className={styles.status} role="status">
            {t("正在读取当前内容，请稍候…", "Fetching the latest content, please wait…")}
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
