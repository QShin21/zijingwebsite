"use client";
import type { ComponentPropsWithoutRef } from "react";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";

/*
 * Bilingual text for shared UI primitives (ui.tsx) that render in both server and
 * client trees and therefore cannot call getT(). Reads the locale from LocaleProvider;
 * outside a provider (tests, design previews) it renders the Chinese text.
 */
export function Tr({ zh, en }: { zh: string; en: string }) {
  return useT()(zh, en);
}

/** Element whose aria-label is localized; the rest of the props pass through. */
export function LabeledNav({ zh, en, ...props }: { zh: string; en: string } & ComponentPropsWithoutRef<"nav">) {
  const t = useT();
  return <nav {...props} aria-label={t(zh, en)} />;
}
export function LabeledOl({ zh, en, ...props }: { zh: string; en: string } & ComponentPropsWithoutRef<"ol">) {
  const t = useT();
  return <ol {...props} aria-label={t(zh, en)} />;
}
export function LabeledSpan({ zh, en, ...props }: { zh: string; en: string } & ComponentPropsWithoutRef<"span">) {
  const t = useT();
  return <span {...props} aria-label={t(zh, en)} />;
}

/** "第 2 / 5 页" or "Page 2 of 5". */
export function PageStatus({ page, totalPages }: { page: number; totalPages: number }) {
  return useLocale() === "en" ? (
    <>
      Page <strong>{page}</strong> of {totalPages}
    </>
  ) : (
    <>
      第 <strong>{page}</strong> / {totalPages} 页
    </>
  );
}
