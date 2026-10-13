"use client";
import { useState } from "react";
import { themeCookieName, themeColors, type ThemeName } from "./theme";
export function ThemeSwitch({ initialTheme }: { initialTheme: ThemeName }) {
  const [theme, setTheme] = useState(initialTheme);
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="z-theme-switch"
      aria-label={`切换到${next === "light" ? "浅" : "深"}色主题`}
      title={`切换到${next === "light" ? "浅" : "深"}色主题`}
      aria-pressed={theme === "dark"}
      onClick={() => {
        document.documentElement.dataset.zTheme = next;
        document.cookie = `${themeCookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        document
          .querySelector('meta[name="color-scheme"]')
          ?.setAttribute("content", next);
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", themeColors[next]);
        setTheme(next);
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {theme === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.5 14.2A9 9 0 0 1 9.8 3.5a9 9 0 1 0 10.7 10.7Z" />
        )}
      </svg>
      <span className="z-theme-label">
        {theme === "light" ? "浅色" : "深色"}
      </span>
    </button>
  );
}
