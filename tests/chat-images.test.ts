import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizeChatImage } from "../src/lib/chat-images";
import { parseStickers, stickerURL } from "../src/lib/chat-stickers";
describe("chat image normalization", () => {
  it("compresses large photos, preserves alpha and limits dimensions", async () => {
    const raw = await sharp({ create: { width: 3000, height: 2200, channels: 4, background: { r: 130, g: 40, b: 100, alpha: 0.5 } } }).png().toBuffer();
    const result = Buffer.from((await normalizeChatImage(`data:image/png;base64,${raw.toString("base64")}`)).split(",")[1], "base64");
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(2048); expect(meta.hasAlpha).toBe(true); expect(result.length).toBeLessThan(raw.length);
  });
  it("rejects active content, corrupt images and oversized payloads", async () => {
    for (const input of ["data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,YWJj", "data:image/png;base64," + "A".repeat(11_200_001)]) await expect(normalizeChatImage(input)).rejects.toThrow();
  });
  it("only accepts fixed provider image paths", () => {
    for (const value of ["http://127.0.0.1/a.gif", "https://img.doutupk.com.evil.test/production/uploads/image/a.gif", "https://img.doutupk.com:443/redirect", "https://x@img.doutupk.com/production/uploads/image/a.gif", "file:///a.gif"]) expect(() => stickerURL(value)).toThrow();
    const url = "http://img.doutupk.com/production/uploads/image/2020/01/a.gif";
    expect(parseStickers(`<img data-original="${url}"><img data-original="${url}"><img data-original="http://localhost/a.gif">`)).toEqual([url.replace("http:", "https:")]);
  });
});
