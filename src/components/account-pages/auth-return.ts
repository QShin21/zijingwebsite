/** Keep authentication return links within this origin, including encoded input. */
export function safeReturnPath(value: unknown, fallback = "/account") {
  if (typeof value !== "string") return fallback;
  const safePath = (path: string) =>
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !Array.from(path).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    );
  try {
    const parsed = new URL(value, "https://return.invalid");
    let candidate = value;
    for (let layer = 0; layer < 6; layer += 1) {
      if (!safePath(candidate)) return fallback;
      const normalized = new URL(candidate, "https://return.invalid");
      if (
        normalized.origin !== "https://return.invalid" ||
        !safePath(normalized.pathname) ||
        /^\/(login|register|account\/reset)(\/|$)/.test(normalized.pathname) ||
        /^\/(https?|javascript|data|vbscript):/i.test(normalized.pathname)
      )
        return fallback;
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate)
        return parsed.pathname + parsed.search + parsed.hash;
      candidate = decoded;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
