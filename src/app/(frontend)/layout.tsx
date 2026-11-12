import { cookies } from "next/headers";
import type { Metadata, Viewport } from "next";
import { site } from "@/lib/content";
import { serverURL } from "@/lib/environment";
import { Footer, MobileTabs, TopBar } from "@/components/v2/Shell";
import { request } from "@/components/v2/data";
import { themeColors, themeCookieName, themeFromPreference } from "@/components/v2/theme";
import shell from "@/components/v2/Shell.module.css";
import "./tokens.css";
import "./v2.css";

export const dynamic = "force-dynamic";

export async function generateViewport(): Promise<Viewport> {
  const theme = themeFromPreference((await cookies()).get(themeCookieName)?.value);
  return { themeColor: themeColors[theme], colorScheme: theme };
}

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

export default async function Layout({ children }: { children: React.ReactNode }) {
  const [s, { user }, store] = await Promise.all([site(), request(), cookies()]);
  const theme = themeFromPreference(store.get(themeCookieName)?.value);
  const viewer = user ? { name: user.name || "成员" } : null;
  return (
    <html lang="zh-CN" data-z-theme={theme}>
      <body>
        <a className={shell.skip} href="#main">
          跳到正文
        </a>
        {process.env.APP_ENV !== "production" && (
          <div className={shell.environment}>开发 / 预览环境 · 内容以正式发布为准</div>
        )}
        <TopBar name={s.name} theme={theme} viewer={viewer} />
        <main id="main" tabIndex={-1} className={shell.main}>
          {children}
        </main>
        <Footer name={s.name} footer={s.footer} />
        <MobileTabs signedIn={Boolean(viewer)} />
      </body>
    </html>
  );
}
