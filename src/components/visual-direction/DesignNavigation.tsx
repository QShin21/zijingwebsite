"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Identity";
import { Pending } from "@/components/Pending";
import { ThemeSwitch } from "./ThemeSwitch";
import type { ThemeName } from "./theme";
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
  const home = preview ? "/design-preview" : "/",
    apply = preview ? "/design-preview/apply" : "/community/apply";
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
      if (window.innerWidth > 1100) close();
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
    (path !== "/" &&
      path !== "/design-preview" &&
      pathname?.startsWith(path + "/"));
  return (
    <>
      <nav className="z-desktop-nav" aria-label="主导航">
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
      <div className="z-header-end">
        <ThemeSwitch initialTheme={theme} />
        <Link
          className="z-user"
          href={signedIn ? "/account" : "/login"}
          onClick={close}
        >
          {signedIn ? "我的紫荆" : "登录"}
        </Link>
        <Link
          className="z-button z-small"
          href={signedIn ? (preview ? apply : "/join") : "/register"}
          onClick={close}
        >
          {signedIn ? (preview ? "参与组织" : "加入紫荆") : "注册"}
          <Icon name="diagonal" />
        </Link>
        <details className="z-mobile-menu" ref={menu} suppressHydrationWarning>
          <summary aria-label="打开导航">
            菜单 <Icon name="plus" />
          </summary>
          <nav aria-label="移动导航">
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
            {signedIn && (
              <Link href={apply} onClick={close}>
                社群管理员申请
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
