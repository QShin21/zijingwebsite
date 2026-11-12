import Image from "next/image";
import Link from "next/link";
import beianIcon from "./beian.png";
import { ThemeToggle } from "./ThemeToggle";
import { BottomTabs, TopLinks, type NavItem } from "./NavLinks";
import type { ThemeName } from "./theme";
import styles from "./Shell.module.css";

const memberTop: NavItem[] = [
  { href: "/", label: "主场", icon: "home", match: ["/"] },
  {
    href: "/events",
    label: "日程",
    icon: "calendar",
    match: ["/events", "/activities"],
  },
  {
    href: "/community",
    label: "社群",
    icon: "community",
    match: ["/community"],
  },
  {
    href: "/teams",
    label: "代表队",
    icon: "trophy",
    match: ["/teams", "/honors"],
  },
  {
    href: "/news",
    label: "动态",
    icon: "news",
    match: ["/news", "/announcements", "/gallery"],
  },
  {
    href: "/account",
    label: "我的主场",
    icon: "user",
    match: ["/account", "/staff"],
  },
];
const guestTop: NavItem[] = [
  { href: "/", label: "主场", icon: "home", match: ["/"] },
  { href: "/events", label: "日程", icon: "calendar", match: ["/events"] },
  {
    href: "/announcements",
    label: "公告",
    icon: "megaphone",
    match: ["/announcements"],
  },
  {
    href: "/about",
    label: "关于紫荆",
    icon: "flag",
    match: ["/about", "/contact", "/privacy"],
  },
];
const memberTabs: NavItem[] = [
  memberTop[0],
  memberTop[1],
  memberTop[2],
  memberTop[3],
  {
    href: "/account",
    label: "我的",
    icon: "user",
    match: ["/account", "/staff"],
  },
];
const guestTabs: NavItem[] = [
  guestTop[0],
  guestTop[1],
  guestTop[2],
  { href: "/join", label: "加入", icon: "spark", match: ["/join"] },
  {
    href: "/login",
    label: "登录",
    icon: "login",
    match: ["/login", "/register", "/account/reset"],
  },
];

export function Brand({ name }: { name: string }) {
  return (
    <Link href="/" className={styles.brand} aria-label={`${name} 主场`}>
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 40 40" width="32" height="32" fill="none">
          <path
            d="M3 3h34v34H3zM10 11h20L11 29h20"
            stroke="var(--z-accent)"
            strokeWidth="3"
          />
        </svg>
      </span>
      <span className={styles.wordmark}>
        <strong>紫荆电竞</strong>
        <small>
          清华大学学生
          <br />
          紫荆电竞社
        </small>
      </span>
    </Link>
  );
}

export function TopBar({
  name,
  theme,
  viewer,
}: {
  name: string;
  theme: ThemeName;
  viewer: { name: string } | null;
}) {
  return (
    <header className={styles.bar}>
      <div className={styles.barInner}>
        <Brand name={name} />
        <nav className={styles.topNav} aria-label="主导航">
          <TopLinks items={viewer ? memberTop : guestTop} />
        </nav>
        <div className={styles.barActions}>
          <ThemeToggle initialTheme={theme} />
          {!viewer && (
            <>
              <Link href="/login" className={styles.loginLink}>
                登录
              </Link>
              <Link href="/join" className={styles.joinPill}>
                加入紫荆
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileTabs({ signedIn }: { signedIn: boolean }) {
  return <BottomTabs items={signedIn ? memberTabs : guestTabs} />;
}

export function Footer({
  name,
  footer,
}: {
  name: string;
  footer?: string | null;
}) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <p className={styles.footerKicker}>清华园，下一局见</p>
          <strong>{name}</strong>
          <p>{footer || "清华大学学生紫荆电竞社。一起玩，认真赢。"}</p>
        </div>
        <nav className={styles.footerNav} aria-label="页脚">
          <div>
            <p>认识紫荆</p>
            <Link href="/about">关于我们</Link>
            <Link href="/contact">联系与合作</Link>
            <Link href="/privacy">隐私说明</Link>
          </div>
          <div>
            <p>参与</p>
            <Link href="/events">日程</Link>
            <Link href="/join">加入紫荆</Link>
            <Link href="/join/staff">骨干招新</Link>
          </div>
          <div>
            <p>记录</p>
            <Link href="/announcements">公告</Link>
            <Link href="/teams/honors">荣誉墙</Link>
            <Link href="/account">我的</Link>
          </div>
        </nav>
      </div>
      <div className={styles.footerLegal}>
        <p>
          © {new Date().getFullYear()} {name}
        </p>
        <nav aria-label="网站备案" className={styles.records}>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            京ICP备2025135109号-2
          </a>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=11010802050680"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image src={beianIcon} alt="" width={16} height={16} unoptimized />
            京公网安备11010802050680号
          </a>
        </nav>
      </div>
    </footer>
  );
}
