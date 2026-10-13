export type ThemeName = "light" | "dark";
export const themeCookieName = "zijing_theme";
export function themeFromPreference(value: string | undefined): ThemeName {
  return value === "dark" ? "dark" : "light";
}
