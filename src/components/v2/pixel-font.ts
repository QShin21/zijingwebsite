import localFont from "next/font/local";

/**
 * Fusion Pixel 12px by TakWolf, SIL Open Font License 1.1 (./fonts/OFL.txt).
 * Served from hashed /_next/static/media; not preloaded, so the file is only fetched when a
 * pixel heading actually renders (the 简约 palette uses system fonts and never requests it).
 */
export const pixelFont = localFont({
  src: "./fonts/fusion-pixel-12px.woff2",
  variable: "--z-pixel-font",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["PingFang SC", "Microsoft YaHei", "Noto Sans SC", "sans-serif"],
});
