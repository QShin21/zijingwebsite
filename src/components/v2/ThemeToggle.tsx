"use client";
import { useEffect, useId, useRef, useState } from "react";
import { themeColors, themeCookieName, themeLabel, themes, themeScheme, type ThemeName } from "./theme";
import { Icon } from "./Icon";
import styles from "./Shell.module.css";

/**
 * Four-palette menu (disclosure + pressed buttons). The server renders the stored choice;
 * switching only updates <html> attributes and the cookie, so forms in progress keep their input.
 */
export function ThemeToggle({ initialTheme }: { initialTheme: ThemeName; compact?: boolean }) {
  const [theme, setTheme] = useState(initialTheme);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function apply(next: ThemeName) {
    const html = document.documentElement;
    html.dataset.zTheme = themeScheme(next);
    html.dataset.zPalette = next;
    document.cookie = `${themeCookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", themeScheme(next));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[next]);
    setTheme(next);
  }

  function choose(next: ThemeName) {
    setOpen(false);
    trigger.current?.focus();
    if (next === theme) return;
    const still = next === "simple" || theme === "simple" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A short stepped wipe where the browser supports view transitions; otherwise switch at once.
    if (!still && typeof document.startViewTransition === "function") document.startViewTransition(() => apply(next));
    else apply(next);
  }

  return (
    <div
      ref={root}
      className={styles.themeMenu}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.iconButton}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`界面风格：${themeLabel(theme)}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={themeScheme(theme) === "dark" ? "moon" : "sun"} size={18} />
        <span className={styles.iconLabel}>{themeLabel(theme)}</span>
      </button>
      <div id={menuId} className={styles.themeOptions} role="group" aria-label="选择界面风格" hidden={!open}>
        {themes.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className={styles.themeOption}
            data-palette={entry.name}
            aria-pressed={theme === entry.name}
            onClick={() => choose(entry.name)}
          >
            <span className={styles.themeSwatch} aria-hidden="true" />
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
