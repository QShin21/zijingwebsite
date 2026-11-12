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

export async function seatRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new SeatRequestError("网络连接中断，请检查网络后重试", 0);
  }
  const result: unknown = await response.json().catch(() => null);
  const message = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "";
  if (!response.ok || !result) throw new SeatRequestError(message || "选座服务暂不可用，请重试", response.status);
  return result as T;
}

export function seatJSON(method: "POST" | "PUT", data: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}
