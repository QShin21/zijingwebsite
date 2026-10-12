"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BrandMark, Icon } from "./Identity";
import { Pending } from "./Pending";

type NavItem = { path: string; label: string };
export function SiteHeader({
  name,
  navigation,
  signedIn = true,
}: {
  name: string;
  navigation: NavItem[];
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const previousPath = useRef(pathname);
  const close = () => {
    if (menu.current) menu.current.open = false;
  };
  useEffect(() => {
    if (previousPath.current !== pathname) {
      if (menu.current) menu.current.open = false;
      previousPath.current = pathname;
    }
  }, [pathname]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
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
      if (window.innerWidth > 1080) close();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    if (menu.current) menu.current.dataset.enhanced = "true";
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
    };
  }, []);
  const active = (path: string) =>
    pathname === path || (path !== "/" && pathname?.startsWith(`${path}/`)) ||
    (path === "/teams" && (pathname === "/honors" || pathname?.startsWith("/honors/")));
  return (
    <header className="site-header">
      <div className="header">
        <Link
          className="brand"
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          onClick={close}
        >
          <BrandMark />
          <span>
            {name}
            <small>ZIJING ESPORTS CLUB</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="主导航">
          {navigation.map((n) => (
            <Link
              href={n.path}
              key={n.path}
              aria-current={active(n.path) ? "page" : undefined}
            >
              {n.label}
              <Pending />
            </Link>
          ))}
          {signedIn && !navigation.some((n) => n.path === "/community") && (
            <Link
              href="/community"
              aria-current={active("/community") ? "page" : undefined}
            >
              游戏社群
              <Pending />
            </Link>
          )}
        </nav>
        <Link className="button compact" href={signedIn ? "/join" : "/register"} onClick={close}>
          {signedIn ? "加入紫荆" : "注册"} <Icon name="diagonal" />
          <Pending />
        </Link>
        <Link className="account-link" href={signedIn ? "/account" : "/login"} onClick={close}>
          {signedIn ? "账号" : "登录"}
        </Link>
        <details
          className="mobile-nav"
          suppressHydrationWarning
          ref={menu}
          onKeyDown={(event) => {
            if (event.key === "Escape" && menu.current?.open) {
              event.preventDefault();
              close();
              menu.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="菜单">
            <span className="menu-lines" aria-hidden="true" />
            <span className="sr-only">菜单</span>
          </summary>
          <nav aria-label="移动导航">
            <p className="eyebrow">EXPLORE ZIJING</p>
            {signedIn && <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              onClick={close}
            >
              首页 <Icon name="diagonal" />
            </Link>}
            {navigation.map((n) => (
              <Link
                href={n.path}
                key={n.path}
                aria-current={active(n.path) ? "page" : undefined}
                onClick={close}
              >
                {n.label}
                <Icon name="diagonal" />
              </Link>
            ))}
            {signedIn && !navigation.some((n) => n.path === "/community") && (
              <Link
                href="/community"
                aria-current={active("/community") ? "page" : undefined}
                onClick={close}
              >
                游戏社群 <Icon name="diagonal" />
              </Link>
            )}
            <Link href={signedIn ? "/account" : "/login"} onClick={close}>
              {signedIn ? "我的账号" : "登录"} <Icon name="diagonal" />
            </Link>
            {signedIn && <Link href="/join" onClick={close}>
              加入紫荆 <Icon name="plus" />
            </Link>}
          </nav>
        </details>
      </div>
    </header>
  );
}
