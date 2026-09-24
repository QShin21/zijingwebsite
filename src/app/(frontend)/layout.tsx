import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { site } from "@/lib/content";
import { serverURL } from "@/lib/environment";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandMark, Icon } from "@/components/Identity";
import "./style.css";
export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  themeColor: "#f7f7fb",
  colorScheme: "light",
};
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
  { path: "/events", label: "活动" },
  { path: "/teams", label: "代表队" },
  { path: "/honors", label: "荣誉档案" },
  { path: "/news", label: "社团动态" },
  { path: "/announcements", label: "通知" },
  { path: "/community", label: "游戏社群" },
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
        <SiteHeader
          name={s.name}
          navigation={s.navigation?.length ? s.navigation : nav}
        />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <div className="footer-main">
            <div className="footer-identity">
              <Link className="brand" href="/">
                <BrandMark />
                <span>
                  {s.name}
                  <small>ZIJING ESPORTS CLUB</small>
                </span>
              </Link>
              <p>{s.footer || "赛场内外，共同热爱。"}</p>
            </div>
            <nav aria-label="探索社团">
              <span className="eyebrow">EXPLORE</span>
              <Link href="/events">社团活动</Link>
              <Link href="/teams">代表队</Link>
              <Link href="/honors">荣誉档案</Link>
              <Link href="/gallery">社团影像</Link>
            </nav>
            <nav aria-label="参与社团">
              <span className="eyebrow">TAKE PART</span>
              <Link href="/join/members">普通社员</Link>
              <Link href="/join/teams">代表队选拔</Link>
              <Link href="/join/staff">骨干招新</Link>
              <Link href="/community">游戏社群</Link>
              <Link href="/contact">
                联系与合作 <Icon name="diagonal" />
              </Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} {s.name}
            </span>
            <nav aria-label="页脚">
              <Link href="/privacy">隐私说明</Link>
              <Link href="/account">我的账号</Link>
              <Link href="/admin">内容管理</Link>
              <a href="#main">回到顶部 ↑</a>
            </nav>
          </div>
          <div className="footer-wordmark" aria-hidden="true">
            ZIJING ESPORTS<span>↗</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
