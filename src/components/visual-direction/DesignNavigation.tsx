"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Identity";
import { Pending } from "@/components/Pending";
import { ThemeSwitch } from "./ThemeSwitch";
import type { ThemeName } from "./theme";
import styles from "./SiteChrome.module.css";
type NavItem = { path: string; label: string };
export function DesignNavigation({
  signedIn,
  navigation,
  preview = true,
  theme = "light",
}: {
  signedIn: boolean;
  navigation?: NavItem[];
  preview?: boolean;
  theme?: ThemeName;
}) {
  const pathname = usePathname(),
    menu = useRef<HTMLDetailsElement>(null),
    previous = useRef(pathname);
  const home = preview ? "/design-preview" : "/";
  const items = navigation ?? [
    { path: home, label: "首页" },
    { path: "/events", label: "社团活动" },
    ...(signedIn
      ? [
          { path: "/community", label: "游戏社群" },
          { path: "/teams", label: "代表队与荣誉" },
        ]
      : []),
    { path: "/announcements", label: "通知" },
  ];
  const close = () => {
    if (menu.current) menu.current.open = false;
  };
  useEffect(() => {
    if (previous.current !== pathname) {
      close();
      previous.current = pathname;
    }
  }, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        close();
        menu.current.querySelector("summary")?.focus();
      }
    };
    const resize = () => {
      if (window.innerWidth > 1160) close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    if (menu.current) menu.current.dataset.enhanced = "true";
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
    };
  }, []);
  const active = (path: string) =>
    pathname === path ||
    (path === "/teams" && pathname?.startsWith("/honors")) ||
    (path === "/news" &&
      ["/announcements", "/gallery"].some(
        (root) => pathname === root || pathname?.startsWith(root + "/"),
      )) ||
    (path !== "/" &&
      path !== "/design-preview" &&
      pathname?.startsWith(path + "/"));
  return (
    <>
      <nav className={styles.desktopNav} aria-label="主导航">
        {items.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            aria-current={active(item.path) ? "page" : undefined}
          >
            {item.label}
            <Pending />
          </Link>
        ))}
      </nav>
      <div className={styles.headerEnd}>
        <ThemeSwitch initialTheme={theme} />
        <Link
          className={styles.user}
          href={signedIn ? "/account" : "/login"}
          onClick={close}
        >
          {signedIn ? "个人中心" : "登录"}
        </Link>
        {!signedIn && (
          <Link
            className={`z-button z-small ${styles.register}`}
            href="/register"
            onClick={close}
          >
            注册
            <Icon name="diagonal" />
          </Link>
        )}
        <details
          className={styles.mobileMenu}
          ref={menu}
          suppressHydrationWarning
        >
          <summary aria-label="打开导航">
            菜单 <Icon name="plus" />
          </summary>
          <nav aria-label="移动导航">
            <p className={styles.menuLabel}>浏览紫荆</p>
            {items.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                aria-current={active(item.path) ? "page" : undefined}
                onClick={close}
              >
                {item.label}
                <Pending />
              </Link>
            ))}
            <p className={styles.menuLabel}>我的参与</p>
            {signedIn && (
              <Link href="/join" onClick={close}>
                参与与招新
              </Link>
            )}
            {preview && (
              <Link href="/design-preview/system" onClick={close}>
                设计系统样张
              </Link>
            )}
            {!signedIn && (
              <Link href="/register" onClick={close}>
                注册账号
              </Link>
            )}
            <Link href={signedIn ? "/account" : "/login"} onClick={close}>
              {signedIn ? "我的账号" : "登录"}
            </Link>
          </nav>
        </details>
      </div>
    </>
  );
}
