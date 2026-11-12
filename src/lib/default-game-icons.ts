import sharp from "sharp";
import type { ImageRef } from "./v2/types";

// Fixed publisher assets; uploaded artwork takes precedence. Sources: docs/COMMUNITY_ICONS.md.
const icons = [
  {
    key: "honor-of-kings",
    titles: ["王者荣耀"],
    slugs: ["honor-of-kings", "hok", "wzry"],
    src: "https://game.gtimg.cn/images/yxzj/pvpcommonimage/header/logo.png",
  },
  {
    key: "cs2",
    titles: ["cs2", "counter-strike 2", "反恐精英2"],
    slugs: ["cs2", "counter-strike-2", "csgo"],
    src: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/logo.png",
  },
  {
    key: "stardew-valley",
    titles: ["星露谷物语", "stardew valley"],
    slugs: ["stardew-valley", "stardew"],
    src: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/413150/logo.png",
  },
  {
    key: "eggy-party",
    titles: ["蛋仔派对"],
    slugs: ["eggy-party", "eggy", "party"],
    src: "https://webinput.nie.netease.com/img/party/icon.png/128",
  },
  {
    key: "league-of-legends",
    titles: ["英雄联盟", "league of legends"],
    slugs: ["league-of-legends", "lol"],
    src: "https://game.gtimg.cn/images/lol/v3/logo-public.png",
  },
];
const size = 512;
const maxBytes = 1024 * 1024;
const rendered = new Map<string, Promise<Buffer>>();

export function defaultGameIcon(title: string, slug: string): ImageRef | null {
  const match = icons.find(
    (icon) =>
      icon.titles.includes(title.trim().toLowerCase()) ||
      icon.slugs.includes(slug.toLowerCase()),
  );
  return match
    ? {
        src: `/api/game-icons/default/${match.key}`,
        width: size,
        height: size,
        alt: `${title}游戏图标`,
      }
    : null;
}

async function renderGameIcon(icon: (typeof icons)[number]) {
  const response = await fetch(icon.src, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (
    !response.ok ||
    !response.body ||
    Number(response.headers.get("content-length")) > maxBytes
  ) {
    await response.body?.cancel();
    throw new Error("默认游戏图标下载失败");
  }
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error("默认游戏图标过大");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const mark = sharp(Buffer.concat(chunks, length), {
    limitInputPixels: 16_000_000,
  });
  const metadata = await mark.metadata();
  if (metadata.format !== "png" || (metadata.pages ?? 1) !== 1)
    throw new Error("默认游戏图标格式无效");
  // Center the mark so the mini program's wide cards can crop the canvas.
  mark.resize(376, 236, { fit: "inside" });
  if (icon.key === "cs2") mark.ensureAlpha().linear(0, 255);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: await mark.png().toBuffer(), gravity: "centre" }])
    .png()
    .toBuffer();
}

export async function readDefaultGameIcon(key: string): Promise<Buffer | null> {
  const icon = icons.find((entry) => entry.key === key);
  if (!icon) return null;
  let image = rendered.get(key);
  if (!image) {
    image = renderGameIcon(icon).catch((error) => {
      rendered.delete(key);
      throw error;
    });
    rendered.set(key, image);
  }
  return image;
}
