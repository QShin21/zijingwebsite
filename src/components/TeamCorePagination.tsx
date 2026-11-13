import Link from "next/link";
import { getT } from "@/lib/i18n/server";
export const teamPage = (value?: string) =>
  Math.max(1, Math.min(10000, Math.floor(Number(value) || 1)));
export async function TeamCorePagination({
  page,
  total,
  path,
  parameter,
  query = {},
  label,
}: {
  page: number;
  total: number;
  path: string;
  parameter: string;
  query?: Record<string, string | undefined>;
  label: string;
}) {
  if (total <= 1) return null;
  const { t } = await getT();
  const href = (next: number) => {
    const params = new URLSearchParams(
      Object.entries(query).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    params.set(parameter, String(next));
    return `${path}?${params}`;
  };
  return (
    <nav className="pagination" aria-label={t(`${label}分页`, `${label} pages`)}>
      {page > 1 && <Link href={href(page - 1)}>{t(`上一页${label}`, `Previous ${label}`)}</Link>}
      <span>{t(`第 ${page} / ${total} 页`, `Page ${page} of ${total}`)}</span>
      {page < total && <Link href={href(page + 1)}>{t(`下一页${label}`, `Next ${label}`)}</Link>}
    </nav>
  );
}
