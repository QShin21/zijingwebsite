import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers, cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cms, site } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import {
  DesignHeader,
  DesignFooter,
} from "@/components/visual-direction/DesignUI";
import "./design.css";
import "@/components/visual-direction/tokens.css";
import "@/components/visual-direction/theme.css";
import {
  themeFromPreference,
  themeCookieName,
  themeColors,
} from "@/components/visual-direction/theme";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "紫荆 · 视觉方向预览",
  robots: { index: false, follow: false },
};
export async function generateViewport(): Promise<Viewport> {
  const theme = themeFromPreference(
    (await cookies()).get(themeCookieName)?.value,
  );
  return {
    themeColor: themeColors[theme],
    colorScheme: theme,
  };
}
export default async function DesignLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (process.env.APP_ENV === "production") notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() }),
    s = await site();
  if (!canParticipate(user)) notFound();
  const theme = themeFromPreference(
    (await cookies()).get(themeCookieName)?.value,
  );
  return (
    <html lang="zh-CN" data-z-theme={theme}>
      <body className="z-design">
        <a className="z-skip" href="#design-main">
          跳到正文
        </a>
        <DesignHeader
          name={s.name}
          signedIn={canParticipate(user)}
          theme={theme}
        />
        <main id="design-main" tabIndex={-1}>
          {children}
        </main>
        <DesignFooter />
      </body>
    </html>
  );
}
