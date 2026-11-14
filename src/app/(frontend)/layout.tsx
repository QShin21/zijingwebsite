import { cookies } from "next/headers";
import type { Metadata, Viewport } from "next";
import { site } from "@/lib/content";
import { canUseCampus } from "@/lib/rules";
import { serverURL } from "@/lib/environment";
import { Footer, MobileTabs, TopBar } from "@/components/v2/Shell";
import { request } from "@/components/v2/data";
import { themeColors, themeCookieName, themeFromPreference, themeScheme } from "@/components/v2/theme";
import { pixelFont } from "@/components/v2/pixel-font";
import { ClientEffects } from "@/components/v2/ClientEffects";
import shell from "@/components/v2/Shell.module.css";
import { localizedSiteTexts } from "@/lib/content-translation/localize";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { englishSiteName, htmlLang, localeCookieName, parseLocale, translator } from "@/lib/i18n/locale";
import "./tokens.css";
import "./v2.css";
import "./pixel.css";

export const dynamic = "force-dynamic";

export async function generateViewport(): Promise<Viewport> {
  const theme = themeFromPreference((await cookies()).get(themeCookieName)?.value);
  return { themeColor: themeColors[theme], colorScheme: themeScheme(theme) };
}

export async function generateMetadata(): Promise<Metadata> {
  const [s, store] = await Promise.all([site(), cookies()]);
  const locale = parseLocale(store.get(localeCookieName)?.value);
  const name = locale === "en" ? englishSiteName : s.name;
  const texts = await localizedSiteTexts({ description: s.description ?? null }, locale);
  return {
    metadataBase: new URL(serverURL),
    title: { default: name, template: `%s | ${name}` },
    description: texts.description || undefined,
    robots:
      process.env.APP_ENV === "production"
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const [s, { user }, store] = await Promise.all([site(), request(), cookies()]);
  const theme = themeFromPreference(store.get(themeCookieName)?.value);
  const locale = parseLocale(store.get(localeCookieName)?.value);
  const t = translator(locale);
  // The CMS site name is Chinese; English mode uses the club's fixed English name.
  const name = locale === "en" ? englishSiteName : s.name;
  const campus = canUseCampus(user);
  const viewer = user ? { name: user.name || t("成员", "Member"), campus } : null;
  return (
    <html lang={htmlLang[locale]} data-z-theme={themeScheme(theme)} data-z-palette={theme} className={pixelFont.variable}>
      <body>
        <LocaleProvider locale={locale}>
          <a className={shell.skip} href="#main">
            {t("跳到正文", "Skip to content")}
          </a>
          {process.env.APP_ENV !== "production" && (
            <div className={shell.environment}>{t("开发 / 预览环境 · 内容以正式发布为准", "Development / preview · published content is authoritative")}</div>
          )}
          <TopBar name={name} theme={theme} viewer={viewer} locale={locale} />
          <main id="main" tabIndex={-1} className={shell.main}>
            {children}
          </main>
          <Footer name={name} footer={(await localizedSiteTexts({ footer: s.footer ?? null }, locale)).footer} campus={campus} locale={locale} />
          <MobileTabs signedIn={Boolean(viewer)} campus={campus} locale={locale} />
          <ClientEffects />
        </LocaleProvider>
      </body>
    </html>
  );
}
