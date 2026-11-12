import sharp from "sharp";
import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import { canManageCommunityIcon } from "./community-icons-access";
import {
  communityIconMaxBytes,
  defaultIconCrop,
  iconCropRect,
  validIconCrop,
  type IconCrop,
} from "./community-icon-shared";
import { workflowTransaction } from "./workflow-transactions";
import { requireViewer } from "./v2/identity";
import { findRow, publicWhere, type Row } from "./v2/shared";
import type { ImageRef } from "./v2/types";
import { defaultGameIcon } from "./default-game-icons";

async function publicGame(p: Payload, slug: string) {
  const game = await findRow(
    p,
    "games",
    slug,
    ["title", "slug"],
    null,
    publicWhere(),
  );
  if (!game) throw new APIError("社群不存在", 404);
  return game;
}
export async function communityIconRef(
  p: Payload,
  game: Row,
): Promise<ImageRef | null> {
  const icons = await p.find({
    collection: "community-icons",
    overrideAccess: false,
    user: null,
    depth: 0,
    limit: 1,
    context: { publicCommunityIcon: game.id },
    where: { game: { equals: game.id } },
    select: { updatedAt: true },
  });
  const icon = icons.docs[0];
  return icon
    ? {
        src: `/api/game-icons/${encodeURIComponent(String(game.slug))}?v=${encodeURIComponent(icon.updatedAt)}`,
        width: 512,
        height: 512,
        alt: `${game.title}游戏图标`,
      }
    : defaultGameIcon(String(game.title), String(game.slug));
}
export async function readCommunityIcon(p: Payload, slug: string) {
  const game = await publicGame(p, slug);
  const icons = await p.find({
    collection: "community-icons",
    overrideAccess: false,
    user: null,
    depth: 0,
    limit: 1,
    context: { publicCommunityIcon: game.id },
    where: { game: { equals: game.id } },
    select: { image: true, updatedAt: true },
  });
  const icon = icons.docs[0];
  if (!icon) throw new APIError("社群尚未上传图标", 404);
  return {
    bytes: Buffer.from(icon.image.split(",")[1], "base64"),
    revision: icon.updatedAt,
  };
}
export async function getCommunityIconEditor(
  p: Payload,
  user: User | null,
  input: { slug: string },
) {
  const actor = await requireViewer(p, user),
    game = await publicGame(p, input.slug);
  if (!canManageCommunityIcon(actor, game.id))
    throw new APIError("仅本社群在任管理员、社长和副社长可修改图标", 403);
  const icons = await p.find({
    collection: "community-icons",
    user: actor,
    overrideAccess: false,
    depth: 0,
    limit: 1,
    where: { game: { equals: game.id } },
    select: {
      game: true,
      source: true,
      crop: true,
      credit: true,
      updatedAt: true,
    },
  });
  const icon = icons.docs[0];
  return {
    title: String(game.title),
    source: icon?.source ?? null,
    crop: validIconCrop(icon?.crop) ? icon.crop : defaultIconCrop,
    credit: icon?.credit ?? "",
    revision: icon?.updatedAt ?? "",
  };
}
export async function prepareCommunityIcon(
  source: unknown,
  crop: unknown,
  normalize = true,
) {
  if (!validIconCrop(crop)) throw new APIError("裁切参数无效，请重新调整", 400);
  if (
    typeof source !== "string" ||
    source.length > 6_000_000 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(source)
  )
    throw new APIError("请选择 PNG、JPEG 或 WebP 图片", 400);
  const bytes = Buffer.from(source.slice(source.indexOf(",") + 1), "base64");
  if (!bytes.length || bytes.length > communityIconMaxBytes)
    throw new APIError("图片大小上限为 4 MB", 400);
  try {
    const meta = await sharp(bytes, {
      limitInputPixels: 16_000_000,
    }).metadata();
    if (
      !["png", "jpeg", "webp"].includes(meta.format ?? "") ||
      !meta.width ||
      !meta.height ||
      (meta.pages ?? 1) !== 1
    )
      throw new Error("format");
    const normalized = normalize
      ? await sharp(bytes, { limitInputPixels: 16_000_000 })
          .rotate()
          .resize({
            width: 2048,
            height: 2048,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 92 })
          .toBuffer({ resolveWithObject: true })
      : { data: bytes, info: { width: meta.width, height: meta.height } };
    const output = await sharp(normalized.data)
      .extract(
        iconCropRect(normalized.info.width, normalized.info.height, crop),
      )
      .resize(512, 512)
      .webp({ quality: 90 })
      .toBuffer();
    return {
      source: `data:image/webp;base64,${normalized.data.toString("base64")}`,
      image: `data:image/webp;base64,${output.toString("base64")}`,
      crop,
    };
  } catch {
    throw new APIError(
      "图片无法读取，请选择静态 PNG、JPEG 或 WebP，最多 1600 万像素",
      400,
    );
  }
}
export async function saveCommunityIcon(
  p: Payload,
  user: User | null,
  input: {
    slug: string;
    source?: unknown;
    crop: IconCrop;
    credit: string;
    revision: string;
  },
) {
  const actor = await requireViewer(p, user),
    game = await publicGame(p, input.slug);
  if (!canManageCommunityIcon(actor, game.id))
    throw new APIError("无权修改此社群图标", 403);
  if (typeof input.credit !== "string" || input.credit.length > 200)
    throw new APIError("图片来源最多填写 200 字", 400);
  // Decode a new upload only after checking current scope.
  const prepared = input.source
    ? await prepareCommunityIcon(input.source, input.crop)
    : null;
  return workflowTransaction(
    p,
    actor,
    { communityIconWrite: true },
    async (req) => {
      if (!canManageCommunityIcon(req.user, game.id))
        throw new APIError("社群管理权限已变更，请刷新页面", 403);
      const icons = await p.find({
        collection: "community-icons",
        req,
        overrideAccess: false,
        depth: 0,
        limit: 1,
        where: { game: { equals: game.id } },
      });
      const current = icons.docs[0];
      if (
        typeof input.revision !== "string" ||
        (current?.updatedAt ?? "") !== input.revision
      )
        throw new APIError("图标已被其他管理员修改，请刷新后重新编辑", 409);
      const image =
        prepared ??
        (await prepareCommunityIcon(current?.source, input.crop, false));
      const data = { ...image, game: game.id, credit: input.credit.trim() };
      const saved = current
        ? await p.update({
            collection: "community-icons",
            id: current.id,
            req,
            overrideAccess: false,
            data,
          })
        : await p.create({
            collection: "community-icons",
            req,
            overrideAccess: false,
            data,
          });
      return {
        revision: saved.updatedAt,
        source: saved.source,
        crop: image.crop,
      };
    },
  );
}
