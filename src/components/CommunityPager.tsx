import Link from "next/link";
import styles from "./community-pages/CommunityPages.module.css";
import { getT } from "@/lib/i18n/server";
export function pageNumber(value?: string) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
}
export async function CommunityPager({
  page,
  pages,
  base,
  query = "",
}: {
  page: number;
  pages: number;
  base: string;
  query?: string;
}) {
  const { t } = await getT();
  return (
    <nav className={styles.pager} aria-label={t("内容分页", "Pagination")}>
      {page > 1 && (
        <Link href={`${base}?page=${page - 1}${query}`}>{t("← 上一页", "← Previous")}</Link>
      )}
      <span>
        {t(`第 ${page} / ${Math.max(1, pages)} 页`, `Page ${page} of ${Math.max(1, pages)}`)}
      </span>
      {page < pages && (
        <Link href={`${base}?page=${page + 1}${query}`}>{t("下一页 →", "Next →")}</Link>
      )}
    </nav>
  );
}
