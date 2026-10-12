// Shared with browser components. Keep server/Payload imports out of this file.
// The HTTP layer uses the same public status/isPublic error contract.
class ProfileValidationError extends Error {
  readonly status = 400;
  readonly isPublic = true;
}

/** Public, opt-in information only. This is never a membership record. */
export type TeamProfileDraft = {
  displayName: string;
  position: string;
  biography: string;
  avatar: string | null;
  visible: boolean;
};
export type PublicTeamProfile = Omit<TeamProfileDraft, "visible"> & {
  id: number;
};
export type OwnTeamProfile = TeamProfileDraft & { revision: number };
export type TeamProfilesView = {
  profiles: PublicTeamProfile[];
  own: { eligible: boolean; profile: OwnTeamProfile | null };
};
export const emptyTeamProfile = (): TeamProfileDraft => ({
  displayName: "",
  position: "",
  biography: "",
  avatar: null,
  visible: false,
});

export function teamProfileID(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new ProfileValidationError("代表队标识无效");
  return Number(value);
}

function plainText(
  value: unknown,
  label: string,
  max: number,
  required = false,
  multiline = false,
) {
  if (typeof value !== "string")
    throw new ProfileValidationError(`${label}格式无效`);
  const result = value.trim();
  const control = Array.from(result).some((character) => {
    const code = character.codePointAt(0)!;
    return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
  });
  // Plain text only: no HTML, control characters or invisible direction overrides.
  if (
    result.length > max ||
    (required && !result) ||
    control ||
    /[<>\u202A-\u202E\u2066-\u2069]/u.test(result) ||
    (!multiline && /[\r\n\t]/u.test(result))
  )
    throw new ProfileValidationError(
      `${label}${required ? "必填，" : ""}最多 ${max} 字，请使用普通文字`,
    );
  return result;
}

export function parseTeamProfile(value: unknown): TeamProfileDraft {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProfileValidationError("简介格式无效");
  const input = value as Record<string, unknown>;
  const keys = ["displayName", "position", "biography", "avatar", "visible"];
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw new ProfileValidationError(
      "简介仅接受公开昵称、位置、介绍、头像和展示选择",
    );
  if (
    typeof input.visible !== "boolean" ||
    (input.avatar !== null && typeof input.avatar !== "string")
  )
    throw new ProfileValidationError(
      "请明确选择是否展示，头像仅接受上传的图片",
    );
  if (input.avatar !== null && !safeTeamProfileAvatar(input.avatar))
    throw new ProfileValidationError(
      "头像仅支持 2 MB 以内的 PNG、JPEG、WebP 上传图片",
    );
  return {
    displayName: plainText(input.displayName, "公开昵称", 40, true),
    position: plainText(input.position, "位置 / 游戏角色", 60),
    biography: plainText(input.biography, "简短介绍", 400, false, true),
    avatar: input.avatar as string | null,
    visible: input.visible,
  };
}

/** Defense at render time, including for old/corrupt stored rows and previews. */
export function safeTeamProfileAvatar(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 2_800_000 &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}

export function sameTeamProfile(a: TeamProfileDraft, b: TeamProfileDraft) {
  return (
    ["displayName", "position", "biography", "avatar", "visible"] as const
  ).every((key) => a[key] === b[key]);
}

export function profileError(error: unknown): {
  status: number;
  error: string;
} {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500 &&
    "isPublic" in error &&
    error.isPublic === true &&
    "message" in error &&
    typeof error.message === "string"
  )
    return { status: error.status, error: error.message };
  return {
    status: 503,
    error: "队员简介暂时无法加载或保存，请稍后重试；已填写的内容会保留。",
  };
}
