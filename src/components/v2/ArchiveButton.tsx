"use client";
import { useRef, useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import styles from "./cards.module.css";
import { useLocale, useT } from "../i18n/LocaleProvider";
import { localizeMessage } from "@/lib/i18n/messages";

/**
 * Personal archive control (display preference only). It sets an explicit
 * archived value — never a toggle on the server — and never cancels a signup,
 * withdraws an application or changes a review state.
 * Rendered above the card's stretched link so a click never opens the detail page.
 */
export function ArchiveButton({ target, archived, title, variant = "icon" }: {
  target: string; archived: boolean; title: string; variant?: "icon" | "text";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");
  const busy = useRef(false);
  const t = useT(),
    locale = useLocale();
  const pending = saving || refreshing;
  const action = archived ? t("撤销归档", "Unarchive") : t("归档", "Archive");
  const label = `${action}${t("：", ": ")}${title}`;

  async function submit(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy.current || pending) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/v2/me/archive", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, archived: !archived }),
      });
      const body = await response.json().catch(() => null) as { error?: unknown; archived?: unknown } | null;
      if (!response.ok || typeof body?.archived !== "boolean") {
        setError(typeof body?.error === "string" ? localizeMessage(body.error, locale) : archived ? t("撤销归档失败，请稍后重试", "Couldn't unarchive. Please try again later.") : t("归档失败，请稍后重试", "Couldn't archive. Please try again later."));
        return;
      }
      // The server page re-reads the overview and full lists; nothing is changed optimistically.
      startRefresh(() => router.refresh());
    } catch {
      setError(archived ? t("撤销归档失败，请检查网络后重试", "Couldn't unarchive. Check your connection and try again.") : t("归档失败，请检查网络后重试", "Couldn't archive. Check your connection and try again."));
    } finally {
      busy.current = false; setSaving(false);
    }
  }

  return (
    <span className={styles.archiveControl} data-variant={variant}>
      <button
        type="button"
        className={styles.archiveButton}
        data-variant={variant}
        data-archived={archived ? "" : undefined}
        onClick={submit}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-label={variant === "icon" ? label : undefined}
        title={variant === "icon" ? (archived ? t("撤销归档，恢复到“我的”总览", "Unarchive and show in the My overview again") : t("归档：仅从“我的”总览隐藏", "Archive: hide from the My overview only")) : undefined}
      >
        <Icon name={archived ? "restore" : "archive"} size={variant === "icon" ? 18 : 15} />
        {variant === "text" && <span>{pending ? t("处理中…", "Working…") : action}</span>}
        {variant === "text" && <span className="sr-only">{t("：", ": ")}{title}</span>}
      </button>
      {error && <span className={styles.archiveError} role="alert">{error}</span>}
    </span>
  );
}
