import { localeCookieName, parseLocale, type Locale } from "@/lib/i18n/locale";
import { localizeError } from "@/lib/i18n/messages";

/** Presentation-layer request feedback. A lost response cannot prove a write failed. */
// i18n-exempt: compared against the legacy Chinese server error
const legacyUnknownWriteMessage = "服务器暂时无法保存申请，请稍后重试；已填写的资料会保留。";

/** Interface language of the browser page (the language switch cookie); Chinese elsewhere. */
function pageLocale(): Locale {
  if (typeof document === "undefined") return "zh";
  const match = new RegExp(`(?:^|;\\s*)${localeCookieName}=([^;]*)`).exec(document.cookie);
  return parseLocale(match?.[1]);
}

export async function activityRequest(url: string, method = "GET", data?: unknown, headers?: Record<string, string>) {
  const reading = method === "GET";
  const en = pageLocale() === "en";
  let response: Response;
  try {
    response = await fetch(url, { method, cache: "no-store", headers: { "Content-Type": "application/json", ...headers }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  } catch {
    throw new Error(
      reading
        ? en ? "The connection was interrupted. Check your network and reload." : "网络连接中断，请检查连接后重新加载。"
        : en
          ? "The submission is not confirmed yet. Your input is kept; refresh your receipt or saved records and check before retrying."
          : "提交结果尚未确认。填写内容已保留，请先刷新本人回执或已保存记录，确认后再重试。",
    );
  }
  let value;
  try { value = await response.json(); }
  catch {
    throw new Error(
      reading
        ? en ? "The server response could not be read. Please reload later." : "暂时无法读取服务器响应，请稍后重新加载。"
        : en
          ? "The server response was incomplete, so the submission is not confirmed. Check your receipt or saved records first; your input is kept."
          : "服务器响应不完整，提交结果尚未确认。请先查看本人回执或已保存记录，填写内容已保留。",
    );
  }
  if (!response.ok) {
    if (!reading && (response.status >= 500 || value.error === legacyUnknownWriteMessage))
      throw new Error(
        en
          ? "The server could not confirm the submission. Your input is kept; refresh your receipt or saved records before deciding whether to retry."
          : "服务器暂时无法确认提交结果。填写内容已保留，请先刷新本人回执或已保存记录，再决定是否重试。",
      );
    if (value.error) throw new Error(localizeError(value.error, en ? "en" : "zh", { status: response.status, code: typeof value.code === "string" ? value.code : undefined }));
    throw new Error(
      response.status === 403
        ? en ? "This account does not have permission for this action." : "当前账号没有此操作权限。"
        : en ? "The request was not accepted. Check your input and try again." : "请求未被接受，请核对内容后重试。",
    );
  }
  return value;
}
