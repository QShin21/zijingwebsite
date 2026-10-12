import { APIError } from "payload";
import type { Payload } from "payload";
import type { TeamHonorRecord, User } from "../payload-types";
import {
  canParticipate,
  canReviewShowcase,
  communityIDs,
  canPublish,
} from "./rules";
import { teamHonorService } from "./team-honor-service";
import {
  saveVideo,
  discardVideo,
  SUBMISSION_MAX_BYTES,
  VIDEO_MAX_BYTES,
} from "./showcase-videos";
import {
  honorID,
  type HonorInput,
  type HonorImage,
  type HonorAction,
} from "./team-honor-model";

export function honorError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "isPublic" in error &&
    error.isPublic === true &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500 &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  if (
    error &&
    typeof error === "object" &&
    "isPublic" in error &&
    error.isPublic === true &&
    "status" in error &&
    error.status === 503 &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("成员权威尚未接入")
  )
    return error.message;
  return "暂时无法保存荣誉，请稍后重试；填写内容仍保留在此页面。";
}
export async function honorWorkspace(
  p: Payload,
  user: User | null,
  view: "mine" | "review",
  page = 1,
) {
  if (!canParticipate(user)) throw new APIError("请先登录", 401);
  // The collection re-reads current scope before returning any private content.
  const records = await p.find({
    collection: "team-honor-records",
    user,
    overrideAccess: false,
    depth: 0,
    page,
    limit: 8,
    sort: "-updatedAt",
    where:
      view === "mine"
        ? { author: { equals: user!.id } }
        : {
            and: [
              { author: { not_equals: user!.id } },
              {
                state: {
                  in: ["pending", "approved", "returned", "rejected", "hidden"],
                },
              },
            ],
          },
  });
  return records;
}
export const honorCanReview = (user: User | null) =>
  canPublish(user) || communityIDs(user, "reviewShowcase").length > 0;
export function honorReviewerOf(user: User | null, record: TeamHonorRecord) {
  return Boolean(
    user &&
      user.id !== Number(record.author) &&
      canReviewShowcase(user, record.game),
  );
}
export async function saveHonorForm(
  p: Payload,
  user: User | null,
  form: FormData,
) {
  const value = (key: string) => String(form.get(key) ?? "").trim();
  const id = value("id") ? honorID(value("id")) : undefined;
  const current = id
    ? await p.findByID({
        collection: "team-honor-records",
        id,
        user,
        overrideAccess: false,
        depth: 0,
      })
    : undefined;
  if (current && (!user || Number(current.author) !== user.id))
    throw new APIError("只能修改自己的荣誉记录", 403);
  const revision = value("revision");
  if (current && Number(revision) !== current.revision)
    throw new APIError("荣誉已更新，请刷新后核对再保存", 409);
  const action = value("action") as HonorAction;
  if (!["save", "submit"].includes(action))
    throw new APIError("保存操作无效", 400);
  const pictures = form
    .getAll("pictures")
    .filter((item): item is File => typeof item !== "string" && item.size > 0);
  const clip = form.get("video"),
    video = typeof clip !== "string" && clip && clip.size ? clip : null;
  if (
    pictures.some((file) => file.size > 2 * 1024 * 1024) ||
    (video && video.size > VIDEO_MAX_BYTES) ||
    pictures.reduce((sum, file) => sum + file.size, 0) + (video?.size ?? 0) >
      SUBMISSION_MAX_BYTES
  )
    throw new APIError(
      "图片每份最多 2 MB，视频最多 10 MB，一次提交总共最多 12 MB",
      400,
    );
  const retained = (
    Array.isArray(current?.images)
      ? (current.images as unknown as HonorImage[])
      : []
  )
    .filter((_, index) => form.get("removeImage-" + index) !== "on")
    .map((image) => ({ ...image }));
  const old = Array.isArray(current?.images)
    ? (current.images as unknown as HonorImage[])
    : [];
  for (const image of retained) {
    const index = old.findIndex((item) => item.source === image.source);
    image.caption = value("caption-" + index);
  }
  if (retained.length + pictures.length > 6)
    throw new APIError("最多保留 6 份证据图片", 400);
  const newImages = await Promise.all(
    pictures.map(async (file, index) => {
      if (
        !/^image\/(png|jpeg|webp)$/.test(file.type) ||
        !/\.(png|jpe?g|webp)$/i.test(file.name)
      )
        throw new APIError("仅支持静态 PNG、JPEG 或 WebP 图片", 400);
      return {
        source:
          "data:" +
          file.type +
          ";base64," +
          Buffer.from(await file.arrayBuffer()).toString("base64"),
        caption: value("newCaption-" + index),
      };
    }),
  );
  let uploaded: string | undefined;
  try {
    if (video) uploaded = await saveVideo(video);
    const input: HonorInput = {
      title: value("title"),
      competition: value("competition"),
      placing: value("placing"),
      date: value("date") || null,
      description: value("description"),
      images: [...retained, ...newImages],
      videoURL:
        uploaded ??
        (form.get("removeVideo") === "on" ? null : current?.videoURL || null),
      ...(!current
        ? {
            team: honorID(value("team")),
            ...(value("season") ? { season: honorID(value("season")) } : {}),
          }
        : {}),
    };
    return await teamHonorService.change(p, user, action, {
      id,
      revision,
      input,
    });
  } catch (error) {
    if (uploaded) await discardVideo(uploaded);
    throw error;
  }
}
