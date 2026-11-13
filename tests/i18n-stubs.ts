import * as locale from "../src/lib/i18n/locale";
import * as messages from "../src/lib/i18n/messages";
import * as messagesAccount from "../src/lib/i18n/messages-account";
import * as labelsAccount from "../src/lib/i18n/labels-account";
import * as labelsManage from "../src/lib/i18n/labels-manage";
import * as labelsPublic from "../src/lib/i18n/labels-public";
import { QuestionText } from "../src/lib/questionnaire-display";

/*
 * Default-language (Chinese) modules for tests that evaluate component source in a
 * sandbox with hand-listed dependencies. Pure i18n modules are the real ones; the server
 * locale reader (cookies) is replaced by a Chinese reader, as in a request without the
 * language cookie.
 */
const server = { getLocale: async () => "zh" as const, getT: async () => ({ locale: "zh" as const, t: locale.translator("zh") }), requestLocale: locale.requestLocale };
// Sandboxes mock React itself, so hook modules are plain Chinese-mode functions.
const identity = ({ children }: { children?: unknown }) => children ?? null;
const provider = {
  LocaleProvider: identity, QuestionTextProvider: identity,
  useLocale: () => "zh", useT: () => locale.translator("zh"), useQuestionText: () => new QuestionText(null, "zh"),
};
const localText = {
  Tr: ({ zh }: { zh: string }) => zh,
  PageStatus: ({ page, totalPages }: { page: number; totalPages: number }) => `第 ${page} / ${totalPages} 页`,
};
const table: Record<string, unknown> = {
  "@/lib/i18n/locale": locale,
  "@/lib/i18n/messages": messages,
  "@/lib/i18n/messages-account": messagesAccount,
  "@/lib/i18n/labels-account": labelsAccount,
  "@/lib/i18n/labels-manage": labelsManage,
  "@/lib/i18n/labels-public": labelsPublic,
  "@/lib/i18n/server": server,
  "@/components/i18n/LocaleProvider": provider,
  "./i18n/LocaleProvider": provider,
  "../i18n/LocaleProvider": provider,
  "@/components/v2/LocalText": localText,
  "./LocalText": localText,
  "../v2/LocalText": localText,
};
export function i18nStub(name: string): unknown {
  return Object.hasOwn(table, name) ? table[name] : undefined;
}
