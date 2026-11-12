"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./v2/community.module.css";

/** Community section tabs on the hue band (概览 / 活动与通知 / 风采 / 队伍). */
export function CommunityNav({ slug }: { slug: string }) {
  const pathname = usePathname() ?? "";
  const base = `/community/${slug}`;
  const items: [string, string, boolean][] = [
    [base, "概览", pathname === base],
    [`${base}/updates`, "活动与通知", pathname.startsWith(`${base}/updates`)],
    [`${base}/showcase`, "风采", pathname.startsWith(`${base}/showcase`)],
    [`/teams?community=${encodeURIComponent(slug)}`, "队伍", false],
  ];
  return (
    <nav className={styles.nav} aria-label="社群分区">
      {items.map(([href, title, current]) => (
        <Link href={href} key={href} aria-current={current ? "page" : undefined}>
          {title}
        </Link>
      ))}
    </nav>
  );
}
