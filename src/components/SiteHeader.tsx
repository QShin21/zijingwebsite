"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BrandMark, Icon } from "./Identity";
import { Pending } from "./Pending";

type NavItem = { path: string; label: string };
export function SiteHeader({ name, navigation }: { name: string; navigation: NavItem[] }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const previousPath = useRef(pathname);
  const close = () => { if (menu.current) menu.current.open = false; };
  useEffect(() => {
    if (previousPath.current !== pathname) {
      if (menu.current) menu.current.open = false;
      previousPath.current = pathname;
    }
  }, [pathname]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target)) close(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) { close(); menu.current.querySelector("summary")?.focus(); }
    };
    const resize = () => { if (window.innerWidth > 1080) close(); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); window.removeEventListener("resize", resize); };
  }, []);
  const active = (path: string) => pathname === path || (path !== "/" && pathname?.startsWith(`${path}/`));
  return <header className="site-header"><div className="header">
    <Link className="brand" href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={close}><BrandMark /><span>{name}<small>ZIJING ESPORTS CLUB</small></span></Link>
    <nav className="desktop-nav" aria-label="主导航">{navigation.map((n) => <Link href={n.path} key={n.path} aria-current={active(n.path) ? "page" : undefined}>{n.label}<Pending /></Link>)}{!navigation.some((n) => n.path === "/community") && <Link href="/community">游戏社群<Pending /></Link>}</nav>
    <Link className="button compact" href="/join" onClick={close}>加入紫荆 <Icon name="diagonal" /><Pending /></Link>
    <Link className="account-link" href="/account" onClick={close}>账号</Link>
    <details className="mobile-nav" ref={menu}>
      <summary aria-label="菜单"><span className="menu-lines" aria-hidden="true" /><span className="sr-only">菜单</span></summary>
      <nav aria-label="移动导航"><p className="eyebrow">EXPLORE ZIJING</p><Link href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={close}>首页 <Icon name="diagonal" /></Link>{navigation.map((n) => <Link href={n.path} key={n.path} aria-current={active(n.path) ? "page" : undefined} onClick={close}>{n.label}<Icon name="diagonal" /></Link>)}<Link href="/community" onClick={close}>游戏社群 <Icon name="diagonal" /></Link><Link href="/account" onClick={close}>我的账号 <Icon name="diagonal" /></Link><Link href="/join" onClick={close}>加入紫荆 <Icon name="plus" /></Link></nav>
    </details>
  </div></header>;
}
