"use client";
import Link from "next/link";
import styles from "./ActivityPages.module.css";
import { useT } from "@/components/i18n/LocaleProvider";
export default function FeatureError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <section className={`${styles.page} ${styles.errorState}`}>
      <h1>{t("内容暂时无法加载", "This content could not be loaded")}</h1>
      <p role="alert">
        {t(
          "请重新加载后继续。如果刚才提交过报名或申请，先到本人回执核对实际结果。",
          "Reload to continue. If you just submitted a sign-up or application, check your receipt for the actual result first.",
        )}
      </p>
      <div className="signup-tools">
        <button type="button" className="button" onClick={reset}>
          {t("重新加载", "Reload")}
        </button>
        <Link className={styles.textAction} href="/account">
          {t("查看我的事务与回执", "My tasks & receipts")}
        </Link>
        <Link className={styles.textAction} href="/events">
          {t("返回活动", "Back to events")}
        </Link>
      </div>
    </section>
  );
}
