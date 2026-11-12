"use client";
import { useState } from "react";
import {
  themes,
  themeColors,
  themeCookieName,
  themeScheme,
  type ThemeName,
} from "./theme";
import { Icon } from "./Icon";
import styles from "./Shell.module.css";

export function ThemeToggle({
  initialTheme,
}: {
  initialTheme: ThemeName;
  compact?: boolean;
}) {
  const [theme, setTheme] = useState(initialTheme);
  return (
    <label className={styles.themePicker}>
      <Icon name={themeScheme(theme) === "dark" ? "moon" : "sun"} size={18} />
      <select
        aria-label="界面风格"
        value={theme}
        onChange={(event) => {
          const next = event.target.value as ThemeName;
          document.documentElement.dataset.zTheme = next;
          document.cookie = `${themeCookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          document
            .querySelector('meta[name="color-scheme"]')
            ?.setAttribute("content", themeScheme(next));
          document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", themeColors[next]);
          setTheme(next);
        }}
      >
        {Object.entries(themes).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} />
    </label>
  );
}
