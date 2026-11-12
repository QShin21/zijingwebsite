import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

// V2 "紫荆赛场" tab icons: 主场 · 日程 · 社群 · 代表队 · 我的.
// Active icons are filled-accent variants so the selected tab reads at a glance.
const root = path.resolve("miniprogram/src/assets");
const tokens = JSON.parse(await fs.readFile("src/design/tokens.json", "utf8"));
await fs.mkdir(root, { recursive: true });
const drawings = {
  home: '<path d="M9 29 32 10l23 19v24a2 2 0 0 1-2 2H40V38H24v17H11a2 2 0 0 1-2-2z"/>',
  calendar:
    '<rect x="9" y="14" width="46" height="41" rx="8"/><path d="M9 27h46M21 8v12M43 8v12"/><path d="M21 37h8v8h-8z"/>',
  community:
    '<circle cx="24" cy="22" r="9"/><path d="M7 54v-6a17 17 0 0 1 34 0v6M41 13a9 9 0 0 1 0 18M47 38a16 16 0 0 1 10 16"/>',
  teams:
    '<path d="M19 9h26v14a13 13 0 0 1-26 0z"/><path d="M19 14h-8v4a9 9 0 0 0 9 9M45 14h8v4a9 9 0 0 1-9 9M32 36v8M22 55h20M25 44h14l2 11H23z"/>',
  user: '<circle cx="32" cy="21" r="11"/><path d="M10 56v-5a22 22 0 0 1 44 0v5"/>',
};
const fills = {
  home: '<path d="M24 38h16v17H24z"/>',
  calendar: '<path d="M21 37h8v8h-8z"/>',
  community: '<circle cx="24" cy="22" r="5"/>',
  teams: '<path d="M23 13h18v10a9 9 0 0 1-18 0z"/>',
  user: '<circle cx="32" cy="21" r="6"/>',
};
let count = 0;
for (const [name, drawing] of Object.entries(drawings)) {
  for (const [suffix, color, active] of [
    ["", tokens.light.muted, false],
    ["-active", tokens.light.action, true],
    ["-dark", tokens.dark.muted, false],
    ["-dark-active", tokens.dark.action, true],
  ]) {
    const accent = active ? `<g fill="${tokens.light.accent}" stroke="none">${fills[name]}</g>` : "";
    const svg = `<svg width="81" height="81" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${accent}<g fill="none" stroke="${color}" stroke-width="${active ? 4.2 : 3.6}" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`;
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(root, `${name}${suffix}.png`));
    count++;
  }
}
console.log(`Generated ${count} original V2 Mini Program tab icons from shared design tokens.`);
