import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('miniprogram/src/assets');
await fs.mkdir(root, { recursive: true });
const drawings = {
  home: '<path d="M10 29 32 10l22 19v23H39V36H25v16H10z"/>',
  calendar: '<rect x="10" y="16" width="44" height="38" rx="6"/><path d="M10 28h44M22 10v13M42 10v13M21 37h7M36 37h7M21 45h7"/>',
  community: '<circle cx="24" cy="22" r="9"/><path d="M7 53v-7a17 17 0 0 1 34 0v7M41 13a9 9 0 0 1 0 18M47 38a16 16 0 0 1 10 15"/>',
  explore: '<circle cx="32" cy="32" r="23"/><path d="m42 22-6 14-14 6 6-14z"/>',
  user: '<circle cx="32" cy="22" r="11"/><path d="M11 55v-6a21 21 0 0 1 42 0v6"/>',
};
for (const [name, drawing] of Object.entries(drawings)) {
  for (const [suffix, color] of [['', '#8a8192'], ['-active', '#6536a6']]) {
    const svg = `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(root, `${name}${suffix}.png`));
  }
}
console.log('Generated 10 original Mini Program tab icons.');
