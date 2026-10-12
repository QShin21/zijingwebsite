import Link from "next/link";
export const teamPage = (value?: string) =>
  Math.max(1, Math.min(10000, Math.floor(Number(value) || 1)));
export function TeamCorePagination({
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
    <nav className="pagination" aria-label={`${label}分页`}>
      {page > 1 && <Link href={href(page - 1)}>上一页{label}</Link>}
      <span>
        第 {page} / {total} 页
      </span>
      {page < total && <Link href={href(page + 1)}>下一页{label}</Link>}
    </nav>
  );
}
