/*
 * Interface language (2026-11-13 bilingual). Chinese stays the default and the
 * fallback for every string; English is an opt-in display layer.
 *
 * Static interface copy is written in place as a Chinese/English pair (`t("中文", "English")`),
 * so a missing English string can never surface as a raw dictionary key: the
 * Chinese text is always the fallback. Published activity and questionnaire
 * content is translated by the server (src/lib/content-translation) and never here.
 */
export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh";
/** Shared by the web cookie and the mini program request header value. */
export const localeCookieName = "zijing_locale";
export const localeHeaderName = "x-zijing-locale";

export function parseLocale(value: unknown): Locale {
  return value === "en" ? "en" : "zh";
}

export type Translate = (zh: string, en: string) => string;

export function translator(locale: Locale): Translate {
  return locale === "en" ? (zh, en) => (typeof en === "string" && en.trim() ? en : zh) : (zh) => zh;
}

export const englishSiteName = "Tsinghua Zijing Esports Club";

export const htmlLang: Record<Locale, string> = { zh: "zh-CN", en: "en" };

/** Beijing-time formatting shared by both languages; activity times are always Asia/Shanghai. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale: Locale,
  options: { time?: boolean; weekday?: boolean; year?: boolean } = {},
): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const format = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "zh-CN", {
    timeZone: "Asia/Shanghai",
    ...(options.year === false ? {} : { year: "numeric" }),
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    ...(options.weekday ? { weekday: "short" } : {}),
    ...(options.time === false ? {} : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  });
  return format.format(date);
}

/** Simple English plural helper; Chinese has no plural forms. */
export function plural(locale: Locale, count: number, zh: string, one: string, many = `${one}s`): string {
  if (locale !== "en") return `${count} ${zh}`;
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Locale of an HTTP request: the mini program sends an explicit header; the website
 * sends its cookie. Anything else is Chinese.
 */
export function requestLocale(request: Request): Locale {
  const header = request.headers.get(localeHeaderName);
  if (header) return parseLocale(header.trim().toLowerCase());
  const cookie = request.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${localeCookieName}=([^;]*)`).exec(cookie);
  return parseLocale(match?.[1]);
}
