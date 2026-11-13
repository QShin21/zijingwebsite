#!/usr/bin/env node
/*
 * Original pixel-art campus scenes for the web hero (2026-11-13 pixel upgrade).
 *
 * Every pixel is drawn by this script from code: no photographs, no real landmark, no school or
 * game marks, no people. The generic hall, clock tower and esports arena are invented; the "Z"
 * pennant repeats the site's existing decorative mark. Output is deterministic (seeded PRNG).
 *
 *   node scripts/pixel-campus-art.mjs          write PNGs to src/components/v2/pixel-art/
 *   node scripts/pixel-campus-art.mjs --check  compare decoded pixels with the committed files
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("src/components/v2/pixel-art");
const W = 480;
const H = 200;
const GROUND = 152;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rgb = (value, alpha = 255) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
  alpha,
];
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)).concat(255);
const dither = (x, y, fraction) => fraction * 16 > BAYER[y & 3][x & 3] + 0.5;

class Canvas {
  constructor(width, height, transparent = false) {
    this.w = width;
    this.h = height;
    this.data = Buffer.alloc(width * height * 4, transparent ? 0 : 255);
  }
  set(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a = color[3] ?? 255;
    if (a >= 255) {
      this.data[i] = color[0];
      this.data[i + 1] = color[1];
      this.data[i + 2] = color[2];
      this.data[i + 3] = 255;
      return;
    }
    if (a <= 0) return;
    const k = a / 255;
    for (let c = 0; c < 3; c++) this.data[i + c] = Math.round(color[c] * k + this.data[i + c] * (1 - k));
    this.data[i + 3] = Math.max(this.data[i + 3], a);
  }
  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
  }
  /** Ordered-dither blend of two colours over a rectangle (0 = all a, 1 = all b). */
  ditherRect(x, y, w, h, a, b, fraction) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, dither(i, j, fraction) ? b : a);
  }
  disc(cx, cy, r, color) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.6) this.set(cx + i, cy + j, color);
  }
  /** Soft pixel halo: alpha falls off in dithered rings. */
  halo(cx, cy, r, color, strength) {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const d = Math.sqrt(i * i + j * j) / r;
        if (d > 1) continue;
        const fraction = (1 - d) * strength;
        if (dither(cx + i, cy + j, fraction)) this.set(cx + i, cy + j, color);
      }
  }
  /** Trapezoid roof: width shrinks by `slope` pixels per row going up. */
  roof(x, baseY, width, height, slope, color, edge) {
    for (let r = 0; r < height; r++) {
      const inset = Math.round(r * slope);
      const y = baseY - 1 - r;
      for (let i = x + inset; i < x + width - inset; i++) this.set(i, y, color);
      if (edge) {
        this.set(x + inset, y, edge);
        this.set(x + width - inset - 1, y, edge);
      }
    }
  }
}

/* ---------- tiny 3×5 glyphs (VS / LIVE / Z), drawn at an integer scale ---------- */
const GLYPHS = {
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  S: ["###", "#..", "###", "..#", "###"],
  L: ["#..", "#..", "#..", "#..", "###"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  E: ["###", "#..", "##.", "#..", "###"],
  Z: ["#####", "...#.", "..#..", ".#...", "#####"],
};
function text(canvas, x, y, word, color, scale = 1, gap = 1) {
  let cursor = x;
  for (const letter of word) {
    const glyph = GLYPHS[letter];
    glyph.forEach((row, gy) =>
      [...row].forEach((cell, gx) => {
        if (cell === "#") canvas.rect(cursor + gx * scale, y + gy * scale, scale, scale, color);
      }),
    );
    cursor += (glyph[0].length + gap) * scale;
  }
}

/* ---------- palettes ---------- */
const palettes = {
  classic: {
    night: true,
    sky: ["#1b1230", "#2b1d48", "#45295f", "#6b3a78"],
    skyStops: [0, 58, 104, 146],
    star: "#fff4d6",
    starDim: "#a995d6",
    moon: "#fff0c4",
    moonShade: "#e3c98d",
    haze: "#3a2754",
    hazeWindow: "#6c4f8c",
    wall: "#5a3e77",
    wallShade: "#462f62",
    trim: "#8c6cab",
    roof: "#2b1f44",
    roofEdge: "#73579a",
    windowDark: "#271b3b",
    lit: "#ffd27a",
    lit2: "#f2ac4f",
    tower: "#66488c",
    towerShade: "#513874",
    clock: "#f4e7c6",
    arena: "#2c2246",
    arenaShade: "#221a38",
    glass: "#3b4b86",
    glassLine: "#2a365f",
    screen: "#120c1f",
    screenText: "#ffe08a",
    teamA: "#c86de0",
    teamB: "#5fd3c1",
    neon: "#ff8fc6",
    live: "#ff5d6c",
    lawn: "#33304c",
    lawn2: "#3d385a",
    path: "#6a5b85",
    pathSeam: "#54476f",
    leaf: ["#e8b13b", "#f7d36b", "#c6861f"],
    fallen: ["#e7ad3a", "#f4cc5b"],
    trunk: "#3b2a2b",
    lampPole: "#231a33",
    lampHead: "#fff0c0",
    lampGlow: "#ffd27a",
    bench: "#8f6d4b",
    pennant: "#c86de0",
  },
  summer: {
    night: true,
    sky: ["#08202a", "#0f3240", "#184c57", "#2c6d69"],
    skyStops: [0, 56, 102, 146],
    star: "#ecfff5",
    starDim: "#86c4bb",
    moon: "#f4f8e4",
    moonShade: "#cddcc2",
    haze: "#15394a",
    hazeWindow: "#3d6e75",
    wall: "#2b5662",
    wallShade: "#214753",
    trim: "#5f939a",
    roof: "#112d38",
    roofEdge: "#4b8088",
    windowDark: "#16353f",
    lit: "#ffe48e",
    lit2: "#f2c464",
    tower: "#30616d",
    towerShade: "#255059",
    clock: "#eaf6e6",
    arena: "#14303b",
    arenaShade: "#0f2630",
    glass: "#1f5b70",
    glassLine: "#164556",
    screen: "#07151a",
    screenText: "#b8ffe6",
    teamA: "#9be6ff",
    teamB: "#ffd36e",
    neon: "#7dffcb",
    live: "#ff6b6b",
    lawn: "#1c4a3a",
    lawn2: "#245b47",
    path: "#2e5a5c",
    pathSeam: "#22494b",
    leaf: ["#2f8c5b", "#49b276", "#1e6243"],
    fallen: [],
    trunk: "#2a2a22",
    lampPole: "#0f2128",
    lampHead: "#fff8d2",
    lampGlow: "#ffe9a2",
    bench: "#6c5a44",
    pennant: "#7dffcb",
    water: "#103746",
    waterLine: "#2d7187",
  },
  winter: {
    night: false,
    sky: ["#b6d1e5", "#d6e4ee", "#f5e6d1", "#ffd7ae"],
    skyStops: [0, 50, 100, 148],
    sun: "#fff7df",
    sunGlow: "#ffe6b0",
    cloud: "#ffffff",
    cloudShade: "#e3eaf1",
    haze: "#c6cfd8",
    hazeWindow: "#b0bcc7",
    wall: "#c58b68",
    wallShade: "#ab7253",
    trim: "#f4e5d1",
    roof: "#596c78",
    roofEdge: "#3e4e58",
    snow: "#ffffff",
    snowShade: "#dce6ee",
    windowDark: "#4b5b67",
    lit: "#ffd88d",
    lit2: "#f3bf68",
    tower: "#d29d79",
    towerShade: "#b88262",
    clock: "#fffaf0",
    arena: "#6b7c8c",
    arenaShade: "#5a6a79",
    glass: "#9cc1da",
    glassLine: "#7ea2bb",
    screen: "#1a2732",
    screenText: "#ffe08a",
    teamA: "#a86bc6",
    teamB: "#49b1a0",
    neon: "#b25fd2",
    live: "#e65a5a",
    lawn: "#f6f6f2",
    lawn2: "#dfe8ee",
    path: "#c8cdd3",
    pathSeam: "#b0b8bf",
    leaf: ["#2f5d4b", "#3f7a62", "#234839"],
    fallen: [],
    trunk: "#6a5244",
    lampPole: "#3e4b55",
    lampHead: "#e9e3d2",
    lampGlow: null,
    bench: "#8b6a4c",
    pennant: "#a86bc6",
  },
};

/* ---------- scene parts ---------- */
function sky(canvas, p) {
  const colors = p.sky.map((value) => rgb(value));
  for (let y = 0; y < GROUND; y++) {
    let k = 0;
    while (k < p.skyStops.length - 2 && y >= p.skyStops[k + 1]) k++;
    const y0 = p.skyStops[k];
    const y1 = p.skyStops[k + 1];
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    const levels = 4;
    const f = t * levels;
    const lo = Math.floor(f);
    const a = mix(colors[k], colors[k + 1], lo / levels);
    const b = mix(colors[k], colors[k + 1], Math.min(levels, lo + 1) / levels);
    for (let x = 0; x < W; x++) canvas.set(x, y, dither(x, y, f - lo) ? b : a);
  }
}

function stars(canvas, p, random) {
  for (let n = 0; n < 90; n++) {
    const x = Math.floor(random() * W);
    const y = Math.floor(random() * 96);
    if (Math.abs(x - 258) < 18 && Math.abs(y - 30) < 18) continue;
    const bright = random() > 0.82;
    canvas.set(x, y, rgb(bright ? p.star : p.starDim));
    if (bright && random() > 0.5) {
      canvas.set(x - 1, y, rgb(p.starDim));
      canvas.set(x + 1, y, rgb(p.starDim));
      canvas.set(x, y - 1, rgb(p.starDim));
      canvas.set(x, y + 1, rgb(p.starDim));
    }
  }
}

function moon(canvas, p) {
  canvas.halo(258, 30, 15, rgb(p.moon, 46), 0.42);
  canvas.disc(258, 30, 9, rgb(p.moon));
  // Crater shading keeps the disc readable as pixel art.
  for (const [x, y, r] of [
    [255, 27, 2],
    [262, 33, 2],
    [260, 25, 1],
    [253, 34, 1],
  ])
    canvas.disc(x, y, r, rgb(p.moonShade));
}

function sun(canvas, p) {
  canvas.halo(196, 92, 34, rgb(p.sunGlow, 140), 0.65);
  canvas.disc(196, 92, 11, rgb(p.sun));
}

function cloud(canvas, p, x, y, scale) {
  const shape = [
    "......####......",
    "....########....",
    "..############..",
    ".##############.",
    "################",
  ];
  shape.forEach((row, j) =>
    [...row].forEach((cell, i) => {
      if (cell !== "#") return;
      for (let a = 0; a < scale; a++)
        for (let b = 0; b < scale; b++) canvas.set(x + i * scale + a, y + j * scale + b, rgb(j >= 3 ? p.cloudShade : p.cloud));
    }),
  );
}

function farSkyline(canvas, p, random) {
  const haze = rgb(p.haze);
  const windowColor = rgb(p.hazeWindow);
  let x = 96;
  while (x < W) {
    const width = 10 + Math.floor(random() * 22);
    const height = 12 + Math.floor(random() * 30) + (x > 220 ? 6 : 0);
    const top = GROUND - 8 - height;
    canvas.rect(x, top, width, height + 8, haze);
    if (random() > 0.5) canvas.roof(x - 1, top, width + 2, 4, 1.4, haze);
    for (let wy = top + 4; wy < GROUND - 10; wy += 5)
      for (let wx = x + 2; wx < x + width - 2; wx += 4) if (random() > (p.night ? 0.72 : 0.6)) canvas.rect(wx, wy, 2, 2, windowColor);
    x += width + Math.floor(random() * 6);
  }
  // Rolling tree line in front of the far blocks.
  for (let i = 0; i < W; i++) {
    const height = 6 + Math.round(3 * Math.sin(i / 7) + 2 * Math.sin(i / 3.1) + (random() > 0.7 ? 1 : 0));
    for (let j = 0; j < height; j++) canvas.set(i, GROUND - 1 - j, haze);
  }
}

function windows(canvas, p, random, x0, y0, columns, rows, w, h, gapX, gapY, litChance) {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const x = x0 + c * (w + gapX);
      const y = y0 + r * (h + gapY);
      const lit = random() < litChance;
      canvas.rect(x, y, w, h, rgb(lit ? (random() > 0.4 ? p.lit : p.lit2) : p.windowDark));
      if (lit && p.night) canvas.rect(x, y, w, 1, rgb(p.lit2));
    }
}

function snowCap(canvas, p, x, y, width) {
  if (!p.snow) return;
  canvas.rect(x, y, width, 2, rgb(p.snow));
  for (let i = x; i < x + width; i += 3) canvas.set(i + 1, y + 2, rgb(p.snowShade));
}

function hall(canvas, p, random) {
  const x = 206;
  const top = 104;
  const width = 92;
  canvas.rect(x, top, width, GROUND - top, rgb(p.wall));
  canvas.rect(x + width - 10, top, 10, GROUND - top, rgb(p.wallShade));
  // Cornice, pediment roof and a plain eave line.
  canvas.rect(x - 3, top - 3, width + 6, 3, rgb(p.trim));
  canvas.roof(x - 2, top - 3, width + 4, 12, 3.4, rgb(p.roof), rgb(p.roofEdge));
  snowCap(canvas, p, x - 2, top - 5, width + 4);
  if (p.snow)
    for (let r = 1; r < 12; r++) {
      const inset = Math.round(r * 3.4);
      for (let i = x - 2 + inset; i < x + width + 2 - inset; i++) if (dither(i, r, 0.34 + r * 0.03)) canvas.set(i, top - 4 - r, rgb(p.snow));
    }
  // Pilasters frame the bays; windows sit between them.
  for (let c = 0; c <= 6; c++) canvas.rect(x + 4 + c * 14, top + 4, 3, GROUND - top - 8, rgb(p.trim));
  windows(canvas, p, random, x + 9, top + 8, 6, 3, 7, 8, 7, 6, p.night ? 0.55 : 0.3);
  // Entrance with steps.
  canvas.rect(x + 39, GROUND - 16, 14, 16, rgb(p.windowDark));
  canvas.rect(x + 41, GROUND - 14, 4, 14, rgb(p.lit2));
  canvas.rect(x + 47, GROUND - 14, 4, 14, rgb(p.lit2));
  canvas.rect(x + 33, GROUND - 3, 26, 3, rgb(p.trim));
  canvas.rect(x + 35, GROUND - 5, 22, 2, rgb(p.trim));
}

function tower(canvas, p, random) {
  const x = 300;
  const top = 50;
  canvas.rect(x, top, 18, GROUND - top, rgb(p.tower));
  canvas.rect(x + 13, top, 5, GROUND - top, rgb(p.towerShade));
  canvas.rect(x - 2, top - 2, 22, 3, rgb(p.trim));
  canvas.roof(x - 1, top - 2, 20, 10, 1, rgb(p.roof), rgb(p.roofEdge));
  snowCap(canvas, p, x - 1, top - 4, 20);
  // Flagpole with the site's decorative "Z" pennant (no institutional mark).
  canvas.rect(x + 9, top - 30, 1, 20, rgb(p.roofEdge));
  canvas.rect(x + 10, top - 30, 12, 8, rgb(p.pennant));
  text(canvas, x + 14, top - 29, "Z", rgb(p.night ? "#ffffff" : "#fffaf0"), 1);
  // Clock face with hands.
  canvas.disc(x + 9, top + 14, 6, rgb(p.trim));
  canvas.disc(x + 9, top + 14, 5, rgb(p.clock));
  canvas.rect(x + 9, top + 10, 1, 5, rgb(p.windowDark));
  canvas.rect(x + 9, top + 14, 4, 1, rgb(p.windowDark));
  // Louvres and slim windows down the shaft.
  for (let y = top + 26; y < GROUND - 14; y += 12) {
    canvas.rect(x + 4, y, 3, 7, rgb(random() < (p.night ? 0.6 : 0.35) ? p.lit : p.windowDark));
    canvas.rect(x + 10, y, 3, 7, rgb(random() < (p.night ? 0.5 : 0.3) ? p.lit2 : p.windowDark));
  }
  canvas.rect(x + 6, GROUND - 12, 6, 12, rgb(p.windowDark));
}

function arena(canvas, p, random) {
  const x = 330;
  const top = 92;
  const width = 146;
  canvas.rect(x, top, width, GROUND - top, rgb(p.arena));
  canvas.rect(x, top, width, 4, rgb(p.arenaShade));
  // Neon roof line and the screen frame.
  canvas.rect(x - 2, top - 2, width + 4, 2, rgb(p.neon));
  if (p.night) {
    canvas.ditherRect(x - 2, top - 5, width + 4, 3, rgb(p.neon, 0), rgb(p.neon, 60), 0.5);
    canvas.ditherRect(x - 2, top + 4, width + 4, 2, rgb(p.neon, 0), rgb(p.neon, 40), 0.35);
  }
  snowCap(canvas, p, x - 2, top - 4, width + 4);
  const sx = x + 16;
  const sy = top + 9;
  const sw = 114;
  const sh = 28;
  canvas.rect(sx - 2, sy - 2, sw + 4, sh + 4, rgb(p.arenaShade));
  canvas.rect(sx, sy, sw, sh, rgb(p.screen));
  // Scoreboard: two team bars, a VS badge and a live dot (no game title or logo).
  canvas.rect(sx + 6, sy + 6, 32, 5, rgb(p.teamA));
  canvas.rect(sx + sw - 38, sy + 6, 32, 5, rgb(p.teamB));
  canvas.rect(sx + 6, sy + 14, 22, 3, rgb(p.teamA, 150));
  canvas.rect(sx + sw - 28, sy + 14, 22, 3, rgb(p.teamB, 150));
  text(canvas, sx + sw / 2 - 7, sy + 6, "VS", rgb(p.screenText), 2, 1);
  canvas.rect(sx + 6, sy + 21, 4, 3, rgb(p.live));
  text(canvas, sx + 12, sy + 20, "LIVE", rgb(p.screenText), 1, 1);
  for (let i = 0; i < 9; i++) canvas.rect(sx + sw - 46 + i * 5, sy + 22, 3, 2, rgb(i % 3 === 0 ? p.teamB : p.teamA, 170));
  // Glass hall below the screen.
  const gy = sy + sh + 6;
  canvas.rect(x + 6, gy, width - 12, GROUND - gy, rgb(p.glass));
  for (let gx = x + 6; gx < x + width - 6; gx += 9) canvas.rect(gx, gy, 1, GROUND - gy, rgb(p.glassLine));
  canvas.rect(x + 6, gy + 7, width - 12, 1, rgb(p.glassLine));
  for (let gx = x + 10; gx < x + width - 10; gx += 9) if (random() < (p.night ? 0.55 : 0.25)) canvas.rect(gx, gy + 9, 6, 4, rgb(p.lit));
  canvas.rect(x + width / 2 - 8, GROUND - 13, 16, 13, rgb(p.windowDark));
  canvas.rect(x + width / 2 - 1, GROUND - 13, 2, 13, rgb(p.glassLine));
  // Vertical banners on both corners carry the decorative "Z" only.
  for (const bx of [x + 2, x + width - 8]) {
    canvas.rect(bx, top + 6, 6, 30, rgb(p.pennant));
    canvas.rect(bx, top + 34, 6, 2, rgb(p.neon));
    text(canvas, bx + 1, top + 10, "Z", rgb("#ffffff"), 1);
  }
}

function deciduous(canvas, p, random, cx, baseY, size) {
  const [mid, light, dark] = p.leaf.map((value) => rgb(value));
  canvas.rect(cx - 1, baseY - size - 2, 3, size + 2, rgb(p.trunk));
  const blobs = [
    [0, -size - 6, size * 0.75],
    [-size * 0.55, -size - 1, size * 0.6],
    [size * 0.55, -size, size * 0.62],
    [0, -size * 1.55, size * 0.55],
  ];
  for (const [dx, dy, r] of blobs) {
    const ox = Math.round(cx + dx);
    const oy = Math.round(baseY + dy);
    const radius = Math.round(r);
    for (let j = -radius; j <= radius; j++)
      for (let i = -radius; i <= radius; i++) {
        if (i * i + j * j > radius * radius + radius * 0.4) continue;
        const shade = (i + j) / (radius * 2);
        let color = mid;
        if (shade < -0.25) color = light;
        else if (shade > 0.3) color = dark;
        if (random() > 0.93) color = random() > 0.5 ? light : dark;
        canvas.set(ox + i, oy + j, color);
      }
  }
}

function pine(canvas, p, cx, baseY, size) {
  const [mid, light, dark] = p.leaf.map((value) => rgb(value));
  canvas.rect(cx - 1, baseY - 4, 3, 4, rgb(p.trunk));
  for (let tier = 0; tier < 3; tier++) {
    const tierBase = baseY - 3 - tier * Math.round(size * 0.42);
    const half = Math.round(size * (0.62 - tier * 0.16));
    const height = Math.round(size * 0.55);
    for (let r = 0; r < height; r++) {
      const reach = Math.round(half * (1 - r / height));
      for (let i = -reach; i <= reach; i++) canvas.set(cx + i, tierBase - r, i < -reach / 3 ? light : i > reach / 3 ? dark : mid);
      if (p.snow && r % 2 === 0) canvas.set(cx - reach, tierBase - r, rgb(p.snow));
    }
    if (p.snow) for (let i = -half + 1; i <= 0; i++) canvas.set(cx + i, tierBase - Math.round(height * (1 + i / half)) + 1, rgb(p.snow));
  }
  if (p.snow) canvas.rect(cx - 1, baseY - 3 - 2 * Math.round(size * 0.42) - Math.round(size * 0.55), 3, 2, rgb(p.snow));
}

function bareTree(canvas, p, cx, baseY, size) {
  const trunk = rgb(p.trunk);
  canvas.rect(cx - 1, baseY - size, 3, size, trunk);
  for (let i = 0; i < size * 0.55; i++) {
    canvas.set(cx - 1 - i, baseY - size * 0.55 - i, trunk);
    canvas.set(cx + 1 + i, baseY - size * 0.7 - i * 0.8, trunk);
    if (i < size * 0.3) canvas.set(cx + i * 0.5, baseY - size - i, trunk);
  }
  if (p.snow) {
    for (let i = 0; i < size * 0.55; i += 2) canvas.set(cx - 1 - i, baseY - size * 0.55 - i - 1, rgb(p.snow));
    for (let i = 0; i < size * 0.55; i += 2) canvas.set(cx + 1 + i, baseY - size * 0.7 - i * 0.8 - 1, rgb(p.snow));
  }
}

function lamp(canvas, p, x) {
  const base = 174;
  if (p.lampGlow) canvas.halo(x + 1, base - 25, 9, rgb(p.lampGlow, 80), 0.5);
  canvas.rect(x, base - 22, 2, 22, rgb(p.lampPole));
  canvas.rect(x - 2, base - 25, 6, 2, rgb(p.lampPole));
  canvas.rect(x - 1, base - 27, 4, 3, rgb(p.lampHead));
  canvas.rect(x - 1, base - 1, 4, 1, rgb(p.lampPole));
}

function bench(canvas, p, x, y) {
  const wood = rgb(p.bench);
  canvas.rect(x, y, 12, 2, wood);
  canvas.rect(x, y + 4, 12, 2, wood);
  canvas.rect(x + 1, y + 6, 1, 3, rgb(p.lampPole));
  canvas.rect(x + 10, y + 6, 1, 3, rgb(p.lampPole));
  if (canvas && p.snow) canvas.rect(x, y - 1, 12, 1, rgb(p.snow));
}

function ground(canvas, p, random, name) {
  const lawn = rgb(p.lawn);
  const lawn2 = rgb(p.lawn2);
  for (let y = GROUND; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fraction = name === "winter" ? 0.18 + ((y - GROUND) / (H - GROUND)) * 0.22 : 0.3 + (random() > 0.85 ? 0.4 : 0);
      canvas.set(x, y, dither(x, y, fraction) ? lawn2 : lawn);
    }
  // Path band with stone seams.
  const path = rgb(p.path);
  const seam = rgb(p.pathSeam);
  for (let y = 172; y < 182; y++)
    for (let x = 0; x < W; x++) canvas.set(x, y, (x + (y > 176 ? 6 : 0)) % 12 === 0 || y === 176 ? seam : path);
  canvas.rect(0, 171, W, 1, seam);
  canvas.rect(0, 182, W, 1, seam);
  if (name === "winter") for (let x = 0; x < W; x++) if (dither(x, 172, 0.45)) canvas.set(x, 172, rgb(p.snow));
  // Fallen ginkgo leaves (autumn) on lawn and path.
  for (let n = 0; n < (p.fallen.length ? 120 : 0); n++) {
    const x = Math.floor(random() * W);
    const y = GROUND + 4 + Math.floor(random() * (H - GROUND - 6));
    canvas.set(x, y, rgb(p.fallen[n % p.fallen.length]));
    if (random() > 0.6) canvas.set(x + 1, y, rgb(p.fallen[(n + 1) % p.fallen.length]));
  }
}

function pond(canvas, p, random) {
  // Summer: a still pond in the calm corner reflects the moon and the lamps.
  const water = rgb(p.water);
  const line = rgb(p.waterLine);
  for (let y = 185; y < H; y++) {
    const inset = Math.max(0, 194 - y) * 4;
    for (let x = 0; x < 300 - inset; x++) canvas.set(x, y, water);
  }
  for (let y = 187; y < H; y += 3)
    for (let x = 6; x < 290; x += 2) if (random() > 0.74) canvas.rect(x, y, 3, 1, line);
  for (let y = 187; y < H; y += 2) canvas.rect(255 + ((y * 7) % 5) - 2, y, 6, 1, rgb(p.moon, 170));
  for (const lampX of [150, 252]) for (let y = 188; y < H; y += 3) canvas.rect(lampX - 1 + ((y * 3) % 3), y, 3, 1, rgb(p.lampGlow, 120));
}

function scene(name) {
  const p = palettes[name];
  const random = prng(name === "classic" ? 1112 : name === "summer" ? 2026 : 1113);
  const canvas = new Canvas(W, H);
  sky(canvas, p);
  if (p.night) {
    stars(canvas, p, random);
    moon(canvas, p);
  } else {
    sun(canvas, p);
    cloud(canvas, p, 40, 22, 2);
    cloud(canvas, p, 262, 40, 1);
    cloud(canvas, p, 360, 18, 2);
  }
  farSkyline(canvas, p, random);
  ground(canvas, p, random, name);
  hall(canvas, p, random);
  tower(canvas, p, random);
  arena(canvas, p, random);
  if (name === "summer") pond(canvas, p, random);
  // Trees: ginkgo (classic), lush crowns (summer), pines with bare trees (winter).
  const trees = [
    [190, GROUND + 4, 14],
    [322, GROUND + 6, 9],
    [470, GROUND + 6, 13],
    [120, GROUND + 2, 9],
  ];
  for (const [x, y, size] of trees) {
    if (name === "winter") {
      if (x === 322 || x === 120) bareTree(canvas, p, x, y, size + 6);
      else pine(canvas, p, x, y, size + 14);
    } else deciduous(canvas, p, random, x, y, size);
  }
  for (const x of [150, 252, 356, 452]) lamp(canvas, p, x);
  bench(canvas, p, 268, 160);
  bench(canvas, p, 410, 160);
  return canvas;
}

/** Repeating skyline silhouette (alpha mask) for inner-page headers and the footer. */
function skyline() {
  const width = 320;
  const height = 48;
  const canvas = new Canvas(width, height, true);
  const ink = [255, 255, 255, 255];
  const random = prng(4096);
  let x = 0;
  while (x < width) {
    const w = 12 + Math.floor(random() * 20);
    const h = 10 + Math.floor(random() * 26);
    canvas.rect(x, height - h, w, h, ink);
    if (random() > 0.55) canvas.roof(x - 1, height - h, w + 2, 5, 1.2, ink);
    x += w + 1 + Math.floor(random() * 4);
  }
  // A small clock tower and tree crowns break the rhythm.
  canvas.rect(150, 6, 10, height - 6, ink);
  canvas.roof(149, 6, 12, 6, 1, ink);
  for (const [cx, r] of [
    [40, 7],
    [96, 6],
    [214, 8],
    [282, 6],
  ])
    canvas.disc(cx, height - r - 2, r, ink);
  return canvas;
}

const outputs = {
  "campus-classic.png": () => scene("classic"),
  "campus-summer.png": () => scene("summer"),
  "campus-winter.png": () => scene("winter"),
  "skyline-mask.png": () => skyline(),
};

async function encode(canvas) {
  return sharp(canvas.data, { raw: { width: canvas.w, height: canvas.h, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

const check = process.argv.includes("--check");
let failed = false;
for (const [file, draw] of Object.entries(outputs)) {
  const canvas = draw();
  const target = path.join(OUT, file);
  if (check) {
    if (!fs.existsSync(target)) {
      console.error(`missing ${file}`);
      failed = true;
      continue;
    }
    const { data, info } = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== canvas.w || info.height !== canvas.h || !data.equals(canvas.data)) {
      console.error(`${file} differs from the generator output`);
      failed = true;
    }
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(target, await encode(canvas));
    console.log(`wrote ${path.relative(process.cwd(), target)}`);
  }
}
if (check) {
  if (failed) process.exit(1);
  console.log(`Checked ${Object.keys(outputs).length} pixel-art outputs.`);
}
