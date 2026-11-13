"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import styles from "./AccountPages.module.css";
import { useLocale, useT } from "../i18n/LocaleProvider";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

export function PasswordField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const t = useT();
  const generatedID = useId();
  const id = props.id || generatedID;
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.password}>
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={hint ? `${id}-hint` : props["aria-describedby"]}
        />
        <button
          type="button"
          aria-controls={id}
          aria-pressed={visible}
          aria-label={t(`${visible ? "隐藏" : "显示"}${label}`, `${visible ? "Hide" : "Show"} ${label}`)}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? t("隐藏", "Hide") : t("显示", "Show")}
        </button>
      </div>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function FormFeedback({
  message,
  error = false,
  focus = false,
}: {
  message: string;
  error?: boolean;
  focus?: boolean;
}) {
  const locale = useLocale();
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message && focus) ref.current?.focus();
  }, [message, focus]);
  if (!message) return null;
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role={error ? "alert" : "status"}
      className={styles.feedback}
      data-kind={error ? "error" : "status"}
    >
      {localizeAccountMessage(message, locale)}
    </p>
  );
}
