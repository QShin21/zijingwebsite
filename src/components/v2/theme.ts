import tokens from "@/design/tokens.json";

export type ThemeName = "light" | "dark";
export const themeCookieName = "zijing_theme";
// Browser chrome color follows the V2 top bar (paper in both modes).
export const themeColors: Record<ThemeName, string> = {
  light: tokens.light.paper,
  dark: tokens.dark.paper,
};
export function themeFromPreference(value: string | undefined): ThemeName {
  return value === "dark" ? "dark" : "light";
}
