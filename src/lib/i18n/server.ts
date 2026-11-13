import { cache } from "react";
import { cookies } from "next/headers";
import { localeCookieName, parseLocale, translator, type Locale } from "./locale";

/** Locale of the current server component render (cookie set by the language switch). */
export const getLocale = cache(async (): Promise<Locale> => parseLocale((await cookies()).get(localeCookieName)?.value));

export async function getT() {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}

export { requestLocale } from "./locale";
