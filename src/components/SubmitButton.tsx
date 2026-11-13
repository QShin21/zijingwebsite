"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "./i18n/LocaleProvider";

export function SubmitButton({
  children,
  className = "button",
  name,
  value,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? t("正在提交…", "Submitting…") : children}
    </button>
  );
}
