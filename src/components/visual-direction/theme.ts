import tokens from "@/design/tokens.json";
export type ThemeName = "light" | "dark";
export const themeCookieName = "zijing_theme";
export const themeColors = {
  light: tokens.light["header-bg"],
  dark: tokens.dark["header-bg"],
};
export function themeFromPreference(value: string | undefined): ThemeName {
  // The public site stores palette names (清华经典/清凉夏夜 are dark) in the same cookie.
  return value === "dark" || value === "classic" || value === "summer" ? "dark" : "light";
}
