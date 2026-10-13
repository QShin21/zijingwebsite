import tokens from "@/design/tokens.json";
export type ThemeName = "light" | "dark";
export const themeCookieName = "zijing_theme";
export const themeColors = {
  light: tokens.light["header-bg"],
  dark: tokens.dark["header-bg"],
};
export function themeFromPreference(value: string | undefined): ThemeName {
  return value === "dark" ? "dark" : "light";
}
