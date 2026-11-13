"use client";
import { createContext, useContext, useMemo } from "react";
import { defaultLocale, translator, type Locale, type Translate } from "@/lib/i18n/locale";
import { QuestionText, type FormDisplay } from "@/lib/questionnaire-display";

const LocaleContext = createContext<Locale>(defaultLocale);

/** Client half of the interface language; the server reads the same cookie. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => translator(locale), [locale]);
}

const QuestionTextContext = createContext<QuestionText | null>(null);

/** Supplies server-translated questionnaire labels (English mode) to every question renderer. */
export function QuestionTextProvider({ display, children }: { display?: FormDisplay | null; children: React.ReactNode }) {
  const locale = useLocale();
  const value = useMemo(() => new QuestionText(locale === "en" ? display : null, locale), [display, locale]);
  return <QuestionTextContext.Provider value={value}>{children}</QuestionTextContext.Provider>;
}

export function useQuestionText(): QuestionText {
  const locale = useLocale();
  const value = useContext(QuestionTextContext);
  return useMemo(() => value ?? new QuestionText(null, locale), [value, locale]);
}
