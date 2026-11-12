
export async function seatRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(result?.error || "选座服务暂不可用，请重试");
  return result as T;
}

export function seatJSON(method: "POST" | "PUT", data: object) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}
