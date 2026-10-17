"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./community-pages/CommunityPages.module.css";
export function CommunityNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/community/${slug}`;
  return (
    <nav className={styles.tabs} aria-label="社群分区">
      {[
        ["", "社群首页"],
        ["updates", "活动与通知"],
        ["showcase", "社群风采"],
      ].map(([path, title]) => (
        <Link
          href={path ? `${base}/${path}` : base}
          key={path}
          aria-current={
            (path ? pathname.startsWith(`${base}/${path}`) : pathname === base)
              ? "page"
              : undefined
          }
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}
