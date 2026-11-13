"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { htmlLang, localeCookieName, type Locale } from "@/lib/i18n/locale";
import { useLocale } from "./LocaleProvider";
import styles from "../v2/Shell.module.css";

/**
 * 中文 / English switch. Persists the choice for a year in a first-party cookie and
 * re-renders server components in place; forms keep their client state.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === "en" ? "zh" : "en";
  return (
    <button
      type="button"
      className={styles.iconButton}
      lang={htmlLang[next]}
      aria-label={next === "en" ? "Switch to English" : "切换到中文"}
      aria-busy={pending}
      data-locale-switch={next}
      onClick={() => {
        document.cookie = `${localeCookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        document.documentElement.lang = htmlLang[next];
        startTransition(() => router.refresh());
      }}
    >
      <span aria-hidden="true">{next === "en" ? "EN" : "中"}</span>
      <span className={styles.iconLabel}>{next === "en" ? "English" : "中文"}</span>
    </button>
  );
}
