import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { boundedFetch, searchStickers, stickerURL } from "@/lib/chat-stickers";
import { normalizeChatImage } from "@/lib/chat-images";
import sharp from "sharp";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const p = await cms(); const { user } = await p.auth({ headers: request.headers });
  if (!canParticipate(user)) return Response.json({ error: "请先登录" }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  try {
    if (params.has("image")) {
      const url = stickerURL(params.get("image") || "");
      const bytes = await boundedFetch(url, 8 * 1024 * 1024);
      if (params.get("preview") === "1") {
        const meta = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
        const types: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
        const type = types[meta.format || ""];
        if (!type) throw new Error("图片格式无效");
        return new Response(bytes, { headers: { ...headers, "Content-Type": type, "X-Content-Type-Options": "nosniff" } });
      }
      const image = await normalizeChatImage(`data:image/gif;base64,${bytes.toString("base64")}`);
      return Response.json({ image }, { headers });
    }
    const q = (params.get("q") || "").trim();
    if (!q || q.length > 40) return Response.json({ error: "请输入 1–40 字的搜索词" }, { status: 400, headers });
    return Response.json({ images: await searchStickers(q) }, { headers });
  } catch { return Response.json({ error: "表情来源暂时不可用，或图片过大，请换一张或稍后重试。" }, { status: 502, headers }); }
}
