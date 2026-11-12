import { APIError, type CollectionBeforeChangeHook } from "payload";
import { publicationImages } from "./publication-images";
import type { ImageRef, PublicationPresentation } from "./v2/types";

export type PublicationBlock = { type: "text"; text: string } | { type: "image"; index: number };

export function publicationBlocks(value: unknown, imageCount: number): PublicationBlock[] {
  if (!Array.isArray(value)) throw new APIError("文章内容格式无效", 400);
  let characters = 0;
  const blocks = value.map((item): PublicationBlock => {
    if (!item || typeof item !== "object") throw new APIError("文章内容格式无效", 400);
    if (item.type === "text" && typeof item.text === "string") {
      characters += item.text.length;
      return { type: "text", text: item.text };
    }
    if (item.type === "image" && Number.isSafeInteger(item.index) && item.index >= 0 && item.index < imageCount)
      return { type: "image", index: item.index };
    throw new APIError("文章中的图片无效，请重新选择", 400);
  });
  if (characters > 5000 || !blocks.some(block => block.type === "image" || block.text.trim()))
    throw new APIError("请填写文章内容，文字最多 5000 字", 400);
  return blocks;
}

export const validatePublicationContent: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const merged = { ...originalDoc, ...data };
  if (merged.contentMode == null || merged.contentMode === "gallery") {
    if (typeof merged.body !== "string" || !merged.body.trim()) throw new APIError("请填写活动或通知正文", 400);
    if (merged.contentMode === "gallery") data.contentBlocks = null;
    return data;
  }
  if (merged.contentMode !== "article") throw new APIError("内容形式无效", 400);
  const blocks = publicationBlocks(merged.contentBlocks, publicationImages(merged.postImages).length);
  data.contentBlocks = blocks;
  data.body = blocks.filter((block): block is Extract<PublicationBlock, { type: "text" }> => block.type === "text")
    .map(block => block.text).join("\n").trim();
  return data;
};

export function projectPublicationContent(mode: unknown, value: unknown, images: (ImageRef | null)[]): PublicationPresentation | null {
  if (mode === "gallery") return { mode, blocks: [] };
  if (mode !== "article") return null;
  try {
    const blocks: PublicationPresentation["blocks"] = [];
    for (const block of publicationBlocks(value, images.length)) {
      if (block.type === "text") blocks.push(block);
      else if (images[block.index]) blocks.push({ type: "image", image: images[block.index]! });
    }
    return { mode, blocks };
  } catch { return null; }
}
