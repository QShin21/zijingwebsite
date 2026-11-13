import { localizeMessage } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Same-origin JSON transport for /api/activities/{kind}/{id}/seating.
 * Errors carry only the server's public message and HTTP status (409 = seat conflict);
 * nothing is logged and no response is cached or persisted.
 */
export class SeatRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SeatRequestError";
  }
}

/** English for the transport's own messages; server messages go through localizeMessage (Chinese fallback). */
const seatErrorsEn: Record<string, string> = {
  网络连接中断请检查网络后重试: "The connection was lost. Check your network and try again.",
  选座服务暂不可用请重试: "Seat selection is temporarily unavailable. Please try again.",
};

/** Displayed error text in the interface language; the thrown message stays Chinese. */
export function localizeSeatError(message: string, locale: Locale): string {
  if (locale !== "en") return message;
  return seatErrorsEn[message.replace(/[，。]/g, "")] ?? localizeMessage(message, locale);
}

export async function seatRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    // i18n-exempt: thrown Chinese contract; displayed via localizeSeatError
    throw new SeatRequestError("网络连接中断，请检查网络后重试", 0);
  }
  const result: unknown = await response.json().catch(() => null);
  const message = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "";
  // i18n-exempt: thrown Chinese contract; displayed via localizeSeatError
  if (!response.ok || !result) throw new SeatRequestError(message || "选座服务暂不可用，请重试", response.status);
  return result as T;
}

export function seatJSON(method: "POST" | "PUT" | "PATCH" | "DELETE", data: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}
