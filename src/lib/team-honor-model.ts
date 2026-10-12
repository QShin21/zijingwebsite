import { createHash } from "node:crypto";
import { APIError } from "payload";

export const honorStates = [
  "draft",
  "pending",
  "withdrawn",
  "returned",
  "rejected",
  "approved",
  "hidden",
] as const;
export type HonorState = (typeof honorStates)[number];
export type HonorAction =
  | "save"
  | "submit"
  | "withdraw"
  | "approve"
  | "return"
  | "reject"
  | "hide";
export const honorLabels: Record<HonorState, string> = {
  draft: "草稿",
  pending: "待审核",
  withdrawn: "已撤回",
  returned: "退回修改",
  rejected: "已拒绝",
  approved: "已批准",
  hidden: "已隐藏",
};
export type HonorImage = { source: string; caption: string };
export type HonorContent = {
  title: string;
  competition: string;
  placing: string;
  date: string | null;
  description: string;
  images: HonorImage[];
  videoURL: string | null;
};
export type HonorInput = Partial<HonorContent> & {
  team?: unknown;
  season?: unknown;
};
export type HonorHistory = {
  action: HonorAction;
  actor: number;
  actorName: string;
  at: string;
  from: HonorState | "new";
  to: HonorState;
  revision: number;
  note: string;
  version?: string;
  /** Private immutable evidence for each approval, retained when later approvals replace the current snapshot. */
  approvedSnapshot?: Record<string, unknown>;
};

export function honorID(value: unknown): number {
  const id =
    typeof value === "object" && value !== null && "id" in value
      ? value.id
      : value;
  if (
    (typeof id !== "string" && typeof id !== "number") ||
    !/^\d+$/.test(String(id)) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  )
    throw new APIError("记录标识无效", 400);
  return Number(id);
}
function text(value: unknown, label: string, limit: number) {
  if (
    typeof value !== "string" ||
    value.trim().length > limit ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 && ![9, 10, 13].includes(code);
    })
  )
    throw new APIError(label + "格式无效或超过" + limit + "字", 400);
  return value.trim();
}
export function honorText(
  input: Record<string, unknown>,
  current?: HonorContent,
): HonorContent {
  const merged = {
    title: "",
    competition: "",
    placing: "",
    date: null,
    description: "",
    images: [],
    videoURL: null,
    ...current,
    ...input,
  };
  const date = merged.date ? String(merged.date) : null;
  // Keep the competition's calendar date stable rather than inferring admission dates.
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date.slice(0, 10))
  )
    throw new APIError("请选择有效的赛事日期", 400);
  return {
    title: text(merged.title, "标题", 120),
    competition: text(merged.competition, "赛事", 200),
    placing: text(merged.placing, "奖项", 200),
    description: text(merged.description, "说明", 5000),
    date: date ? date.slice(0, 10) + "T00:00:00.000Z" : null,
    images: merged.images,
    videoURL: merged.videoURL || null,
  };
}
export function completeHonor(content: HonorContent) {
  for (const [key, label] of [
    ["title", "标题"],
    ["competition", "赛事"],
    ["placing", "奖项"],
    ["date", "赛事日期"],
    ["description", "说明"],
  ] as const)
    if (!content[key]) throw new APIError("提交前请填写" + label, 400);
  if (!content.images.length && !content.videoURL)
    throw new APIError("提交前请上传至少一份本站证据图片或 MP4", 400);
  if (content.images.some((image) => !image.caption.trim()))
    throw new APIError("请为每份证据图片填写说明", 400);
}
export function nextHonorState(
  state: HonorState | "new",
  action: HonorAction,
): HonorState {
  if (action === "save" && state !== "new") return "draft";
  if (state === "new" && ["save", "submit"].includes(action))
    return action === "submit" ? "pending" : "draft";
  if (
    action === "submit" &&
    ["draft", "returned", "rejected", "withdrawn", "hidden"].includes(state)
  )
    return "pending";
  if (action === "withdraw" && state === "pending") return "withdrawn";
  if (["approve", "return", "reject"].includes(action) && state === "pending")
    return action === "approve"
      ? "approved"
      : action === "return"
        ? "returned"
        : "rejected";
  if (action === "hide" && state === "approved") return "hidden";
  throw new APIError("此荣誉已更新或当前状态不支持该操作，请刷新后核对", 409);
}
export function honorReviewNote(value: unknown, action: HonorAction) {
  const note = text(value ?? "", "审核说明", 1000);
  if (["return", "reject", "hide"].includes(action) && !note)
    throw new APIError("退回、拒绝或隐藏须填写具体说明", 400);
  return note;
}
export function honorVersion(
  content: HonorContent,
  attribution: {
    team: number;
    game: number;
    author: number;
    authorName: string;
    season?: number | null;
  },
  videoVersion: string | null,
) {
  // Canonical field order, decoded image bytes, and controlled video bytes form the reviewed version.
  const value = {
    ...attribution,
    title: content.title,
    competition: content.competition,
    placing: content.placing,
    date: content.date,
    description: content.description,
    images: content.images.map((image) => ({
      sha256: createHash("sha256")
        .update(Buffer.from(image.source.split(",")[1] ?? "", "base64"))
        .digest("hex"),
      caption: image.caption,
    })),
    videoURL: content.videoURL,
    videoVersion,
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function honorArchiveHref(slug: string, team: number) {
  return (
    "/community/" +
    encodeURIComponent(slug) +
    "/showcase/team-honors/" +
    honorID(team)
  );
}
