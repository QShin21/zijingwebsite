import Link from "next/link";
import styles from "./community-pages/CommunityPages.module.css";
export function pageNumber(value?: string) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
}
export function CommunityPager({
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
  return (
    <nav className={styles.pager} aria-label="内容分页">
      {page > 1 && (
        <Link href={`${base}?page=${page - 1}${query}`}>← 上一页</Link>
      )}
      <span>
        第 {page} / {Math.max(1, pages)} 页
      </span>
      {page < pages && (
        <Link href={`${base}?page=${page + 1}${query}`}>下一页 →</Link>
      )}
    </nav>
  );
}
