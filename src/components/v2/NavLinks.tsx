"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import styles from "./Shell.module.css";
import { useT } from "@/components/i18n/LocaleProvider";

export type NavItem = { href: string; label: string; icon: IconName; match: string[] };

function active(path: string, item: NavItem) {
  return item.match.some((prefix) => (prefix === "/" ? path === "/" : path === prefix || path.startsWith(`${prefix}/`)));
}

/** Desktop top-bar links with a lime underline marker on the active domain. */
export function TopLinks({ items }: { items: NavItem[] }) {
  const path = usePathname() ?? "/";
  return (
    <ul className={styles.topLinks}>
      {items.map((item) => {
        const current = active(path, item);
        return (
          <li key={item.href}>
            <Link href={item.href} className={styles.topLink} aria-current={current ? "page" : undefined}>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Mobile bottom tab bar (< 1024px). No hamburger: five fixed destinations. */
export function BottomTabs({ items, label }: { items: NavItem[]; label?: string }) {
  const t = useT();
  const path = usePathname() ?? "/";
  return (
    <nav className={styles.tabs} aria-label={label ?? t("主要栏目", "Main sections")}>
      <ul>
        {items.map((item) => {
          const current = active(path, item);
          return (
            <li key={item.href}>
              <Link href={item.href} className={styles.tab} aria-current={current ? "page" : undefined}>
                <span className={styles.tabIcon}>
                  <Icon name={item.icon} size={22} />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
