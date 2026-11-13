import { applicationError } from "@/lib/application-error";
import type { Locale } from "@/lib/i18n/locale";
import { localizeMessage } from "@/lib/i18n/messages";
/** Chinese by default (server actions keep their contract); pass the locale to localize. */
export function workflowFeedback(error: unknown, locale: Locale = "zh") {
  const expected = error && typeof error === "object" && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500 && "isPublic" in error && error.isPublic === true;
  if (expected) return localizeMessage(applicationError(error), locale);
  return locale === "en"
    ? "The server could not confirm the result. Your input is kept; refresh your saved records to check before retrying."
    : "服务器暂时无法确认操作结果。填写内容已保留，请先刷新已保存记录核对后再重试。";
}
