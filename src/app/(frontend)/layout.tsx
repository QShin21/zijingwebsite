import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/content";
import {serverURL} from '@/lib/environment';
import {Pending} from '@/components/Pending';
import "./style.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const s = await site();
  return {
    metadataBase: new URL(serverURL),
    title: { default: s.name, template: `%s | ${s.name}` },
    description: s.description || undefined,
    robots:
      process.env.APP_ENV === "production"
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}
const nav = [
  { path: "/about", label: "关于" },
  { path: "/events", label: "活动" },
  { path: "/teams", label: "代表队" },
  { path: "/honors", label: "荣誉" },
  { path: "/news", label: "动态" },
  { path: "/gallery", label: "影像" },
];
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await site();
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <a className="skip" href="#main">
          跳到正文
        </a>
        {process.env.APP_ENV !== "production" && (
          <div className="environment">
            开发 / 预览环境 · 内容以正式发布为准
          </div>
        )}
        <header className="header">
          <Link className="brand" href="/">
            <span className="brand-mark">紫</span>
            <span>
              {s.name}
              <small>ZIJING ESPORTS</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="主导航">
            {(s.navigation?.length ? s.navigation : nav).map((n) => (
              <Link href={n.path} key={n.path}>
                {n.label}
                <Pending/>
              </Link>
            ))}
          </nav>
          <Link className="button compact" href="/join">
            加入紫荆
            <Pending/>
          </Link>
          <details className="mobile-nav">
            <summary>菜单</summary>
            <nav aria-label="移动导航">
              {(s.navigation?.length ? s.navigation : nav).map((n) => (
                <Link href={n.path} key={n.path}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </details>
        </header>
        <main id="main">{children}</main>
        <footer>
          <div>
            <strong>{s.name}</strong>
            <p>{s.footer || "社团活动、代表队与共同的热爱。"}</p>
          </div>
          <nav aria-label="页脚">
            <Link href="/contact">联系与合作</Link>
            <Link href="/privacy">隐私说明</Link>
            <Link href="/admin">内容管理</Link>
          </nav>
          <p className="meta">
            © {new Date().getFullYear()} {s.name}
          </p>
        </footer>
      </body>
    </html>
  );
}
