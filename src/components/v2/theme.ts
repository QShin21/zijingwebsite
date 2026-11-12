export const themes = {
  classic: "清华经典",
  summer: "清凉夏夜",
  winter: "温煦冬日",
  simple: "简约",
} as const;
export type ThemeName = keyof typeof themes;
export const themeCookieName = "zijing_theme";
export const themeColors: Record<ThemeName, string> = {
  classic: "#30273f",
  summer: "#1b333d",
  winter: "#f3eee3",
  simple: "#ffffff",
};
export function themeFromPreference(value: string | undefined): ThemeName {
  if (value === "light") return "winter";
  if (value === "dark") return "classic";
  return value && Object.hasOwn(themes, value)
    ? (value as ThemeName)
    : "classic";
}
export function themeScheme(theme: ThemeName): "light" | "dark" {
  return theme === "winter" || theme === "simple" ? "light" : "dark";
}
