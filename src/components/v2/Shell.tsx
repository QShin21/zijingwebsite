import Image from "next/image";
import Link from "next/link";
import beianIcon from "./beian.png";
import { ThemeToggle } from "./ThemeToggle";
import { BottomTabs, TopLinks, type NavItem } from "./NavLinks";
import { initial } from "./format";
import type { ThemeName } from "./theme";
import styles from "./Shell.module.css";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { translator, type Locale } from "@/lib/i18n/locale";

function navigation(locale: Locale) {
  const t = translator(locale);
  const memberTop: NavItem[] = [
    { href: "/", label: t("主场", "Home"), icon: "home", match: ["/"] },
    { href: "/events", label: t("日程", "Schedule"), icon: "calendar", match: ["/events", "/activities"] },
    { href: "/community", label: t("社群", "Communities"), icon: "community", match: ["/community"] },
    { href: "/teams", label: t("代表队", "Teams"), icon: "trophy", match: ["/teams", "/honors"] },
    { href: "/news", label: t("动态", "News"), icon: "news", match: ["/news", "/announcements", "/gallery"] },
  ];
  const guestTop: NavItem[] = [
    { href: "/", label: t("主场", "Home"), icon: "home", match: ["/"] },
    { href: "/events", label: t("日程", "Schedule"), icon: "calendar", match: ["/events"] },
    { href: "/announcements", label: t("公告", "Notices"), icon: "megaphone", match: ["/announcements"] },
    { href: "/about", label: t("关于紫荆", "About"), icon: "flag", match: ["/about", "/contact", "/privacy"] },
  ];
  const memberTabs: NavItem[] = [
    memberTop[0],
    memberTop[1],
    memberTop[2],
    memberTop[3],
    { href: "/account", label: t("我的", "Me"), icon: "user", match: ["/account", "/staff"] },
  ];
  const guestTabs: NavItem[] = [
    guestTop[0],
    guestTop[1],
    guestTop[2],
    { href: "/join", label: t("加入", "Join"), icon: "spark", match: ["/join"] },
    { href: "/login", label: t("登录", "Sign in"), icon: "login", match: ["/login", "/register", "/account/reset"] },
  ];
  const visitorTabs: NavItem[] = [...guestTabs.slice(0, 3), memberTabs[4]];
  return { memberTop, guestTop, memberTabs, guestTabs, visitorTabs };
}

export function Brand({ name, locale = "zh" }: { name: string; locale?: Locale }) {
  return (
    <Link href="/" className={styles.brand} aria-label={locale === "en" ? `${name} home` : `${name} 主场`}>
      <span className={styles.mark} aria-hidden="true">
        {/* 8×8 pixel badge with the site's decorative Z (not an institutional mark). */}
        <svg viewBox="0 0 8 8" width="32" height="32" shapeRendering="crispEdges">
          <rect width="8" height="8" fill="var(--z-px-outline)" />
          <rect x="0.5" y="0.5" width="7" height="7" fill="var(--z-action)" />
          <rect x="7" y="0" width="1" height="1" fill="var(--z-accent)" />
          <path d="M1.5 1.5h5v1h-1v1h-1v1h-1v1h-1v-1h1v-1h1v-1h-3z" fill="var(--z-action-ink)" />
          <path d="M1.5 5.5h5v1h-5z" fill="var(--z-action-ink)" />
        </svg>
      </span>
      <span className={styles.wordmark}>
        <strong>{name}</strong>
        <small>THU ZIJING ESPORTS</small>
      </span>
    </Link>
  );
}

export function TopBar({
  name,
  theme,
  viewer,
  locale = "zh",
}: {
  name: string;
  theme: ThemeName;
  viewer: { name: string; campus?: boolean } | null;
  locale?: Locale;
}) {
  const t = translator(locale);
  const { memberTop, guestTop } = navigation(locale);
  return (
    <header className={styles.bar}>
      <div className={styles.barInner}>
        <Brand name={name} locale={locale} />
        <nav className={styles.topNav} aria-label={t("主导航", "Main navigation")}>
          <TopLinks items={viewer && viewer.campus !== false ? memberTop : guestTop} />
        </nav>
        <div className={styles.barActions}>
          <LanguageToggle />
          <ThemeToggle initialTheme={theme} />
          {viewer ? (
            <Link href="/account" className={styles.avatarLink} aria-label={t(`我的：${viewer.name}`, `Me: ${viewer.name}`)}>
              <span className={styles.avatar} aria-hidden="true">
                {initial(viewer.name)}
              </span>
              <span className={styles.avatarName}>{viewer.name}</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.loginLink}>
                {t("登录", "Sign in")}
              </Link>
              <Link href="/join" className={styles.joinPill}>
                {t("加入紫荆", "Join Zijing")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileTabs({ signedIn, campus = signedIn, locale = "zh" }: { signedIn: boolean; campus?: boolean; locale?: Locale }) {
  const { memberTabs, visitorTabs, guestTabs } = navigation(locale);
  const t = translator(locale);
  return <BottomTabs items={campus ? memberTabs : signedIn ? visitorTabs : guestTabs} label={t("主要栏目", "Main sections")} />;
}

export function Footer({ name, footer, campus = false, locale = "zh" }: { name: string; footer?: string | null; campus?: boolean; locale?: Locale }) {
  const t = translator(locale);
  return (
    <footer className={styles.footer}>
      <span className={styles.footerSkyline} aria-hidden="true" />
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <p className={styles.footerKicker}>{t("紫荆赛场 · MATCHDAY", "ZIJING ARENA · MATCHDAY")}</p>
          <strong>{name}</strong>
          <p>{locale === "en" ? (footer && !/[㐀-鿿]/.test(footer) ? footer : "Tsinghua University Zijing Esports Club. Play together, win for real.") : footer || "清华大学学生紫荆电竞社。一起玩，认真赢。"}</p>
        </div>
        <nav className={styles.footerNav} aria-label={t("页脚", "Footer")}>
          <div>
            <p>{t("认识紫荆", "About Zijing")}</p>
            <Link href="/about">{t("关于我们", "About us")}</Link>
            <Link href="/contact">{t("联系与合作", "Contact & partnership")}</Link>
            <Link href="/privacy">{t("隐私说明", "Privacy")}</Link>
          </div>
          <div>
            <p>{t("参与", "Take part")}</p>
            <Link href="/events">{t("日程", "Schedule")}</Link>
            <Link href="/join">{t("加入紫荆", "Join Zijing")}</Link>
            {campus && <Link href="/join/staff">{t("骨干招新", "Staff recruitment")}</Link>}
          </div>
          <div>
            <p>{t("记录", "Records")}</p>
            <Link href="/announcements">{t("公告", "Notices")}</Link>
            {campus && <Link href="/teams/honors">{t("荣誉墙", "Honor wall")}</Link>}
            <Link href="/account">{t("我的", "Me")}</Link>
          </div>
        </nav>
      </div>
      <div className={styles.footerLegal}>
        <p>
          © {new Date().getFullYear()} {name}
        </p>
        <nav aria-label={t("网站备案", "Site registration")} className={styles.records}>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
            {/* i18n-exempt: official ICP registration number */}
            京ICP备2025135109号-2
          </a>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=11010802050680"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image src={beianIcon} alt="" width={16} height={16} unoptimized />
            {/* i18n-exempt: official public security registration number */}
            京公网安备11010802050680号
          </a>
        </nav>
      </div>
    </footer>
  );
}
