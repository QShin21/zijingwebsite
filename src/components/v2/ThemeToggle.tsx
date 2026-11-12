"use client";
import { useState } from "react";
import { themeColors, themeCookieName, type ThemeName } from "./theme";
import { Icon } from "./Icon";
import styles from "./Shell.module.css";

/** Explicit day/night switch. The server renders the stored choice; no system listener. */
export function ThemeToggle({ initialTheme, compact = false }: { initialTheme: ThemeName; compact?: boolean }) {
  const [theme, setTheme] = useState(initialTheme);
  const next: ThemeName = theme === "light" ? "dark" : "light";
  const current = theme === "light" ? "日场" : "夜场";
  const action = `切换到${next === "light" ? "日场（浅色）" : "夜场（深色）"}主题`;
  // WCAG 2.5.3: the accessible name starts with the visible word, then states the action.
  const name = compact ? action : `${current}，${action}`;
  return (
    <button
      type="button"
      className={styles.iconButton}
      data-compact={compact || undefined}
      aria-label={name}
      title={action}
      aria-pressed={theme === "dark"}
      onClick={() => {
        document.documentElement.dataset.zTheme = next;
        document.cookie = `${themeCookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", next);
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[next]);
        setTheme(next);
      }}
    >
      <Icon name={theme === "light" ? "sun" : "moon"} size={20} />
      {!compact && <span className={styles.iconLabel}>{current}</span>}
    </button>
  );
}
