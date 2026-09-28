// Only retrieve images from the search provider's fixed image host. Never follow redirects.
export function stickerURL(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "img.doutupk.com" || url.port || url.username || url.password || !/^\/production\/uploads\/image\/[A-Za-z0-9/_-]+\.(gif|jpg|jpeg|png|webp)$/.test(url.pathname) || url.search || url.hash) throw new Error("表情图片地址无效");
  url.protocol = "https:";
  return url.href;
}
export async function boundedFetch(url: string, limit: number) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12000), cache: "no-store" });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > limit) throw new Error("表情来源暂时不可用");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > limit) throw new Error("表情文件过大"); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
export function parseStickers(html: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/data-original="([^"]+)"/g)) {
    try { urls.add(stickerURL(match[1])); } catch { /* Ignore unrelated provider assets. */ }
  }
  return [...urls].slice(0, 24);
}
export async function searchStickers(query: string) {
  const html = (await boundedFetch(`https://www.doutupk.com/search?keyword=${encodeURIComponent(query)}`, 2_000_000)).toString("utf8");
  if (!html.includes("data-original=") && !html.includes("没有找到")) throw new Error("表情搜索暂时不可用，请稍后再试");
  return parseStickers(html);
}
