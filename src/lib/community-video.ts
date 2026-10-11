export function communityVideo(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    let input = value.trim();
    if (/^\/api\/showcase-videos\/[0-9a-f-]{36}\.mp4$/.test(input)) return { url: input, embed: null, direct: true };
    if (input.startsWith('<')) {
      const src = /^<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/iframe>$/i.exec(input);
      if (!src) return null;
      input = src[1].replace(/&amp;/g, '&');
      if (!/^(?:https:)?\/\/player\.bilibili\.com\/player\.html\?/.test(input)) return null;
    }
    if (input.startsWith('//player.bilibili.com/')) input = 'https:' + input;
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    let match = /^(?:\/video\/)(BV[1-9A-HJ-NP-Za-km-z]{10}|av\d+)\/?$/.exec(url.pathname);
    const player = url.hostname === 'player.bilibili.com' && url.pathname === '/player.html';
    if (player) {
      const id = url.searchParams.get('bvid') || (url.searchParams.get('aid') ? 'av' + url.searchParams.get('aid') : '');
      match = /^(BV[1-9A-HJ-NP-Za-km-z]{10}|av\d+)$/.exec(id);
      if (!match) return null;
    }
    const bili = ["www.bilibili.com", "bilibili.com", "m.bilibili.com"].includes(url.hostname);
    let embed: string | null = null;
    if ((bili || player) && match) {
      const query = new URLSearchParams({ autoplay: "0", poster: "1" });
      query.set(match[1].startsWith("BV") ? "bvid" : "aid", match[1].replace(/^av/, ""));
      const page = Number(url.searchParams.get("p") || url.searchParams.get('page'));
      if (Number.isSafeInteger(page) && page > 0 && page <= 1000) query.set("p", String(page));
      embed = `https://player.bilibili.com/player.html?${query}`;
    }
    const page = Number(url.searchParams.get('p') || url.searchParams.get('page'));
    const canonical = player && match ? `https://www.bilibili.com/video/${match[1]}/${Number.isSafeInteger(page) && page > 0 && page <= 1000 ? '?p=' + page : ''}` : url.href;
    return { url: canonical, embed, direct: /\.mp4$/i.test(url.pathname) };
  } catch { return null; }
}
