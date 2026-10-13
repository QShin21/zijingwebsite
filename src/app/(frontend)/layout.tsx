import { headers, cookies } from "next/headers";
import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import type { Metadata, Viewport } from "next";
import { site } from "@/lib/content";
import { serverURL } from "@/lib/environment";
import {
  DesignHeader,
  DesignFooter,
} from "@/components/visual-direction/DesignUI";
import "./style.css";
import "@/components/visual-direction/tokens.css";
import "../(design)/design.css";
import "./field.css";
import "@/components/visual-direction/theme.css";
import {
  themeFromPreference,
  themeCookieName,
} from "@/components/visual-direction/theme";
export const dynamic = "force-dynamic";
export async function generateViewport(): Promise<Viewport> {
  const theme = themeFromPreference(
    (await cookies()).get(themeCookieName)?.value,
  );
  return {
    themeColor: theme === "light" ? "#fffdf8" : "#17151c",
    colorScheme: theme,
  };
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
const nav = [
  { path: "/events", label: "活动" },
  { path: "/teams", label: "代表队与荣誉" },
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
  const { user } = await (await cms()).auth({ headers: await headers() });
  const signedIn = canParticipate(user);
  const theme = themeFromPreference(
    (await cookies()).get(themeCookieName)?.value,
  );
  const navigation = (s.navigation?.length ? s.navigation : nav).reduce<
    { path: string; label: string }[]
  >((items, item) => {
    const path = item.path === "/honors" ? "/teams" : item.path;
    if (!items.some((entry) => entry.path === path))
      items.push({
        path,
        label: path === "/teams" ? "代表队与荣誉" : item.label,
      });
    return items;
  }, []);
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" data-z-theme={theme}>
      <body className="z-design field-design">
        <a className="skip" href="#main">
          跳到正文
        </a>
        {process.env.APP_ENV !== "production" && (
          <div className="environment">
            开发 / 预览环境 · 内容以正式发布为准
          </div>
        )}
        <DesignHeader
          preview={false}
          name={s.name}
          navigation={
            signedIn
              ? navigation
              : nav.filter((item) =>
                  ["/events", "/announcements"].includes(item.path),
                )
          }
          signedIn={signedIn}
          theme={theme}
        />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <DesignFooter preview={false} name={s.name} footer={s.footer} />
      </body>
    </html>
  );
}
