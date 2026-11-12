"use client";
import { useEffect, useRef, useState } from "react";
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
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const choose = (next: ThemeName) => {
    document.documentElement.dataset.zTheme = next;
    document.cookie = `${themeCookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute("content", themeScheme(next));
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColors[next]);
    setTheme(next);
    if (menu.current) {
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
  };
  return (
    <details
      ref={menu}
      className={styles.themeMenu}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className={styles.themePicker} aria-label="界面风格">
        <Icon name={themeScheme(theme) === "dark" ? "moon" : "sun"} size={18} />
        <span>{themes[theme]}</span>
        <Icon name="chevronDown" size={14} />
      </summary>
      <div
        className={styles.themeOptions}
        role="group"
        aria-label="选择界面风格"
      >
        {(Object.entries(themes) as [ThemeName, string][]).map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => choose(value)}
            >
              {label}
            </button>
          ),
        )}
      </div>
    </details>
  );
}
