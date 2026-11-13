"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./v2/community.module.css";
import { useT } from "@/components/i18n/LocaleProvider";

/** Community section tabs on the hue band (概览 / 活动与通知 / 风采 / 队伍). */
export function CommunityNav({ slug }: { slug: string }) {
  const t = useT();
  const pathname = usePathname() ?? "";
  const base = `/community/${slug}`;
  const items: [string, string, boolean][] = [
    [base, t("概览", "Overview"), pathname === base],
    [`${base}/updates`, t("活动与通知", "Events & notices"), pathname.startsWith(`${base}/updates`)],
    [`${base}/showcase`, t("风采", "Showcase"), pathname.startsWith(`${base}/showcase`)],
    [`/teams?community=${encodeURIComponent(slug)}`, t("队伍", "Teams"), false],
  ];
  return (
    <nav className={styles.nav} aria-label={t("社群分区", "Community sections")}>
      {items.map(([href, title, current]) => (
        <Link href={href} key={href} aria-current={current ? "page" : undefined}>
          {title}
        </Link>
      ))}
    </nav>
  );
}
