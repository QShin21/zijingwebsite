import type { Identity } from "./rules";

// Next start/dev sets PORT to the actual listening port before serving requests.
// Keep this on loopback: neither Host nor a caller-supplied URL chooses the target.
export async function proxyMember(headers: Headers): Promise<Identity | null> {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid application port");
  const credentials = new Headers();
  for (const name of ["cookie", "authorization", "origin", "sec-fetch-site"]) {
    const value = headers.get(name);
    if (value) credentials.set(name, value);
  }
  if (!credentials.has("cookie") && !credentials.has("authorization")) return null;
  const response = await fetch(`http://127.0.0.1:${port}/api/users/me`, {
    headers: credentials, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Session verification unavailable");
  const result = await response.json() as { user?: Identity | null };
  return result.user ?? null;
}
