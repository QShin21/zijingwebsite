import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { site } from "@/lib/content";
import { Footer, MobileTabs, TopBar } from "@/components/v2/Shell";
import { request } from "@/components/v2/data";
import { themeColors, themeCookieName, themeFromPreference } from "@/components/v2/theme";
import shell from "@/components/v2/Shell.module.css";
import "../(frontend)/tokens.css";
import "../(frontend)/v2.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "紫荆 · V2 组件样张", robots: { index: false, follow: false } };

export async function generateViewport(): Promise<Viewport> {
  const theme = themeFromPreference((await cookies()).get(themeCookieName)?.value);
  return { themeColor: themeColors[theme], colorScheme: theme };
}

/** Non-production specimen of the V2 system for signed-in reviewers. */
export default async function DesignLayout({ children }: { children: ReactNode }) {
  if (process.env.APP_ENV === "production") notFound();
  const [{ user }, s, store] = await Promise.all([request(), site(), cookies()]);
  if (!user) notFound();
  const theme = themeFromPreference(store.get(themeCookieName)?.value);
  return (
    <html lang="zh-CN" data-z-theme={theme}>
      <body>
        <a className={shell.skip} href="#design-main">
          跳到正文
        </a>
        <div className={shell.environment}>V2 组件样张 · 仅非生产环境</div>
        <TopBar name={s.name} theme={theme} viewer={{ name: user.name || "成员" }} />
        <main id="design-main" tabIndex={-1} className={shell.main}>
          {children}
        </main>
        <Footer name={s.name} footer={s.footer} />
        <MobileTabs signedIn />
      </body>
    </html>
  );
}
