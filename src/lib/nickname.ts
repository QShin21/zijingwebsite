// Preserve the display name; use this key for uniqueness and login matching.
export const nicknameKey = (value: string) => value.trim().toLowerCase();

// Nicknames cannot be confused with an email.
export function validNickname(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length >= 2 &&
    value.length <= 40 &&
    !/[@\p{Cc}]/u.test(value)
  );
}
