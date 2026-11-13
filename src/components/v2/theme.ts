/*
 * Web themes (pixel campus, 2026-11-13). Four palettes share one cookie with the previous
 * day/night switch:
 *   - stored "light" (and no preference at all) keeps the light-first default → 温煦冬日
 *   - stored "dark" keeps a dark page → 清华经典
 * `data-z-theme` on <html> stays the light/dark colour scheme that tokens.css and existing
 * modules already key on; `data-z-palette` selects the web-only pixel palette (pixel.css).
 * The mini program maps its stored light/dark preferences to the same landmark themes.
 */
export const themeCookieName = "zijing_theme";

export type ThemeName = "classic" | "summer" | "winter" | "simple";
export type ColorScheme = "light" | "dark";

export const themes: readonly { name: ThemeName; label: string; labelEn: string; scheme: ColorScheme; color: string }[] = [
  { name: "classic", label: "清华经典", labelEn: "Tsinghua Classic", scheme: "dark", color: "#2a1f3d" }, // i18n-exempt: paired with labelEn
  { name: "summer", label: "清凉夏夜", labelEn: "Summer Night", scheme: "dark", color: "#0f2530" }, // i18n-exempt: paired with labelEn
  { name: "winter", label: "温煦冬日", labelEn: "Warm Winter", scheme: "light", color: "#f3eee4" }, // i18n-exempt: paired with labelEn
  { name: "simple", label: "简约", labelEn: "Simple", scheme: "light", color: "#f7f7f5" }, // i18n-exempt: paired with labelEn
];

/** First visit and the legacy "light" preference both resolve here (light first). */
export const defaultTheme: ThemeName = "winter";

const legacy: Record<string, ThemeName> = { light: "winter", dark: "classic" };

export function themeFromPreference(value: string | undefined): ThemeName {
  if (value && Object.hasOwn(legacy, value)) return legacy[value];
  return themes.some((theme) => theme.name === value) ? (value as ThemeName) : defaultTheme;
}

export function themeScheme(theme: ThemeName): ColorScheme {
  return themes.find((entry) => entry.name === theme)?.scheme ?? "light";
}

export function themeLabel(theme: ThemeName, locale: "zh" | "en" = "zh"): string {
  const entry = themes.find((item) => item.name === theme);
  return (locale === "en" ? entry?.labelEn : entry?.label) ?? theme;
}

/** Browser chrome colour: the page paper of each palette. */
export const themeColors: Record<ThemeName, string> = Object.fromEntries(
  themes.map((theme) => [theme.name, theme.color]),
) as Record<ThemeName, string>;
