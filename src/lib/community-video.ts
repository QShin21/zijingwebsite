export function communityVideo(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const match = /^(?:\/video\/)(BV[1-9A-HJ-NP-Za-km-z]{10}|av\d+)\/?$/.exec(url.pathname);
    const bili = ["www.bilibili.com", "bilibili.com", "m.bilibili.com"].includes(url.hostname);
    let embed: string | null = null;
    if (bili && match) {
      const query = new URLSearchParams({ autoplay: "0", poster: "1" });
      query.set(match[1].startsWith("BV") ? "bvid" : "aid", match[1].replace(/^av/, ""));
      const page = Number(url.searchParams.get("p"));
      if (Number.isSafeInteger(page) && page > 0 && page <= 1000) query.set("p", String(page));
      embed = `https://player.bilibili.com/player.html?${query}`;
    }
    return { url: url.href, embed };
  } catch { return null; }
}
