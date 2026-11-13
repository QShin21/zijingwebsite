/* global Component */
// 像素校园 · original pixel-art night campus drawn on the device with Canvas 2D (2026-11-13).
// Invented hall, clock tower and esports arena on a coarse grid; no photo, landmark, logo or person.
// It never requests data; it pauses while the page is hidden or the canvas is off screen, repaints
// at ~12 fps, and the page stays complete when the canvas is unavailable (static WXSS stage).
const theme = require('../../lib/theme');
const palettes = {
  // light preference: winter night with snow; dark preference: autumn night with ginkgo leaves.
  light: { sky: ['#1d1430', '#2b2350', '#3f3a70', '#5d5a92'], star: '#fff7dc', moon: '#fff4d0', haze: '#332a55', wall: '#5a4a80', shade: '#463a68', trim: '#9a8cc0',
    roof: '#e9eef6', dark: '#221a3a', lit: '#ffd88d', tower: '#66568e', arena: '#2a2446', glass: '#4a5c96', screen: '#120c1f', teamA: '#c58be0', teamB: '#5fd3c1',
    neon: '#b9a6ff', live: '#ff5d6c', ground: '#dfe6f2', ground2: '#c6d0e4', path: '#8f93b4', leaf: ['#2f5d4b', '#3f7a62'], trunk: '#4a3a3a', glow: '255,226,160', flake: '#ffffff', snow: true },
  dark: { sky: ['#1b1230', '#2b1d48', '#45295f', '#6b3a78'], star: '#fff4d6', moon: '#fff0c4', haze: '#3a2754', wall: '#5a3e77', shade: '#462f62', trim: '#8c6cab',
    roof: '#2b1f44', dark: '#271b3b', lit: '#ffd27a', tower: '#66488c', arena: '#2c2246', glass: '#3b4b86', screen: '#120c1f', teamA: '#c86de0', teamB: '#5fd3c1',
    neon: '#ff8fc6', live: '#ff5d6c', ground: '#33304c', ground2: '#3d385a', path: '#6a5b85', leaf: ['#e8b13b', '#f7d36b'], trunk: '#3b2a2b', glow: '255,210,122', flake: '#f4c94f', snow: false },
};
function prng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
Component({
  properties: { density: { type: Number, value: 1 } },
  data: { ready: false },
  lifetimes: {
    ready() { this.setup(); },
    detached() { this.stop(); this.disposed = true; if (this.observer) this.observer.disconnect(); },
  },
  pageLifetimes: {
    show() { this.hidden = false; this.mode = theme.get() === 'dark' ? 'dark' : 'light'; this.start(); },
    hide() { this.hidden = true; this.stop(); },
  },
  methods: {
    setup() {
      try {
        this.createSelectorQuery().select('#zj-stage-canvas').fields({ node: true, size: true }).exec(result => {
          const entry = result && result[0];
          if (!entry || !entry.node || this.disposed) return;
          const canvas = entry.node, context = canvas.getContext('2d');
          const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : {};
          const ratio = Math.min(2, info.pixelRatio || 2);
          canvas.width = Math.round(entry.width * ratio); canvas.height = Math.round(entry.height * ratio);
          context.scale(ratio, ratio);
          this.canvas = canvas; this.context = context; this.width = entry.width; this.height = entry.height;
          this.mode = theme.get() === 'dark' ? 'dark' : 'light';
          this.seed(); this.draw(0); this.setData({ ready: true });
          this.observer = this.createIntersectionObserver();
          this.observer.relativeToViewport().observe('#zj-stage-canvas', res => {
            this.offscreen = !(res.intersectionRatio > 0);
            if (this.offscreen) this.stop(); else this.start();
          });
          this.start();
        });
      } catch { /* Canvas is decorative; missing support leaves the static stage. */ }
    },
    seed() {
      // One art pixel = `unit` CSS px; the scene is laid out on that grid, anchored bottom-right.
      this.unit = Math.max(2, Math.round(this.width / 150));
      this.cols = Math.ceil(this.width / this.unit); this.rows = Math.ceil(this.height / this.unit);
      const random = prng(1113);
      this.stars = Array.from({ length: Math.round(46 * (this.properties.density || 1)) }, () => ({ x: Math.floor(random() * this.cols), y: Math.floor(random() * this.rows * .55), phase: random() * 6.28, big: random() > .85 }));
      this.blocks = []; let x = 0;
      while (x < this.cols) { const w = 6 + Math.floor(random() * 10), h = 5 + Math.floor(random() * 12); this.blocks.push({ x, w, h, win: random() }); x += w + 1 + Math.floor(random() * 3); }
      this.windows = Array.from({ length: 40 }, () => random());
      this.flakes = Array.from({ length: Math.round(26 * (this.properties.density || 1)) }, () => ({ x: random() * this.cols, y: random() * this.rows, v: .25 + random() * .5, sway: random() * 6.28 }));
      this.sparks = [];
    },
    start() {
      if (this.running || !this.canvas || this.hidden || this.offscreen || this.disposed) return;
      this.running = true; this.painted = 0;
      const loop = time => {
        if (!this.running) return;
        if (time - this.painted >= 80) { this.painted = time; this.draw(time); }
        this.frame = this.canvas.requestAnimationFrame(loop);
      };
      this.frame = this.canvas.requestAnimationFrame(loop);
    },
    stop() {
      this.running = false;
      if (this.canvas && this.frame) this.canvas.cancelAnimationFrame(this.frame);
    },
    touch(event) {
      const point = event.touches && event.touches[0];
      if (!point || !this.sparks || this.sparks.length > 40) return;
      for (let i = 0; i < 3; i++) this.sparks.push({ x: point.x / this.unit, y: point.y / this.unit, vx: (Math.random() - .5) * 1.2, vy: -Math.random() * 1.2, life: 10 });
    },
    release() {},
    draw(time) {
      const c = this.context, u = this.unit, cols = this.cols, rows = this.rows, t = time / 1000, p = palettes[this.mode] || palettes.light;
      const rect = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x) * u, Math.round(y) * u, Math.round(w) * u, Math.round(h) * u); };
      const ground = Math.round(rows * .88);
      c.clearRect(0, 0, this.width, this.height);
      // sky bands
      const band = Math.ceil(ground / 4);
      p.sky.forEach((color, i) => rect(0, i * band, cols, band + 1, color));
      // stars and moon (upper right, clear of the copy)
      this.stars.forEach(star => {
        c.globalAlpha = .35 + .65 * Math.abs(Math.sin(t * .8 + star.phase));
        rect(star.x, star.y, 1, 1, p.star);
        if (star.big) { rect(star.x - 1, star.y, 3, 1, p.star); rect(star.x, star.y - 1, 1, 3, p.star); }
      });
      c.globalAlpha = 1;
      const mx = cols - 22, my = Math.round(rows * .16);
      c.globalAlpha = .18; rect(mx - 2, my - 2, 11, 11, p.moon); c.globalAlpha = 1;
      rect(mx + 1, my, 5, 7, p.moon); rect(mx, my + 1, 7, 5, p.moon);
      // far skyline
      this.blocks.forEach(block => {
        rect(block.x, ground - block.h, block.w, block.h, p.haze);
        if (block.win > .5) rect(block.x + 2, ground - block.h + 2, 1, 1, p.trim);
      });
      // ground and path
      rect(0, ground, cols, rows - ground, p.ground);
      for (let x = 0; x < cols; x += 2) rect(x + (Math.floor(x / 2) % 2), ground + 1, 1, 1, p.ground2);
      rect(0, ground + 3, cols, 3, p.path);
      // buildings, right aligned: hall · clock tower · arena
      const bx = Math.max(Math.round(cols * .3), cols - 74);
      const hall = { x: bx, w: 26, top: ground - 16 };
      rect(hall.x, hall.top, hall.w, 16, p.wall); rect(hall.x + hall.w - 3, hall.top, 3, 16, p.shade);
      for (let r = 0; r < 4; r++) rect(hall.x - 1 + r * 3, hall.top - 1 - r, hall.w + 2 - r * 6, 1, p.snow ? p.roof : p.dark);
      rect(hall.x - 1, hall.top - 1, hall.w + 2, 1, p.snow ? p.roof : p.trim);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++)
        rect(hall.x + 2 + col * 4, hall.top + 2 + row * 4, 2, 3, this.windows[row * 6 + col] > .45 ? p.lit : p.dark);
      rect(hall.x + 11, ground - 5, 4, 5, p.dark);
      const tx = hall.x + hall.w + 2;
      rect(tx, ground - 34, 7, 34, p.tower); rect(tx + 5, ground - 34, 2, 34, p.shade);
      rect(tx - 1, ground - 35, 9, 1, p.snow ? p.roof : p.trim); rect(tx + 1, ground - 37, 5, 2, p.dark); rect(tx + 3, ground - 38, 1, 1, p.dark);
      rect(tx + 3, ground - 46, 1, 8, p.trim); rect(tx + 4, ground - 46 + (Math.sin(t * 2) > 0 ? 0 : 1), 5, 3, p.teamA);
      rect(tx + 2, ground - 31, 3, 3, p.star); rect(tx + 3, ground - 30, 1, 1, p.dark);
      for (let i = 0; i < 4; i++) rect(tx + 2, ground - 24 + i * 5, 2, 3, this.windows[20 + i] > .4 ? p.lit : p.dark);
      const ax = tx + 10, aw = Math.max(20, cols - ax - 1), atop = ground - 20;
      rect(ax, atop, aw, 20, p.arena);
      rect(ax - 1, atop - 1, aw + 2, 1, p.neon);
      c.globalAlpha = .25 + .2 * Math.abs(Math.sin(t * 1.5)); rect(ax - 1, atop - 2, aw + 2, 1, p.neon); c.globalAlpha = 1;
      const sx = ax + 3, sw = aw - 6, sy = atop + 3;
      rect(sx, sy, sw, 9, p.screen);
      rect(sx + 1, sy + 2, Math.round(sw * .3), 2, p.teamA); rect(sx + sw - 1 - Math.round(sw * .3), sy + 2, Math.round(sw * .3), 2, p.teamB);
      const mid = sx + Math.floor(sw / 2);
      rect(mid - 2, sy + 2, 1, 3, p.lit); rect(mid - 1, sy + 5, 1, 1, p.lit); rect(mid, sy + 2, 1, 3, p.lit); // V
      rect(mid + 2, sy + 2, 2, 1, p.lit); rect(mid + 2, sy + 3, 1, 1, p.lit); rect(mid + 2, sy + 4, 2, 1, p.lit); rect(mid + 3, sy + 5, 1, 1, p.lit); rect(mid + 2, sy + 6, 2, 1, p.lit); // S
      if (Math.floor(t * 2) % 2 === 0) rect(sx + 1, sy + 6, 2, 2, p.live);
      c.globalAlpha = .16; rect(sx, sy + (Math.floor(t * 6) % 9), sw, 1, '#ffffff'); c.globalAlpha = 1;
      rect(ax + 2, sy + 11, aw - 4, ground - sy - 11, p.glass);
      for (let gx = ax + 2; gx < ax + aw - 2; gx += 4) rect(gx, sy + 11, 1, ground - sy - 11, p.arena);
      // trees and lamps
      const tree = (cx, size) => {
        rect(cx, ground - size, 1, size, p.trunk);
        if (p.snow) { for (let r = 0; r < size; r++) { const half = Math.ceil((size - r) / 2.2); rect(cx - half, ground - 2 - r, half * 2 + 1, 1, r % 3 === 2 ? p.flake : p.leaf[r % 2]); } }
        else { rect(cx - 3, ground - size - 3, 7, 5, p.leaf[0]); rect(cx - 2, ground - size - 5, 5, 2, p.leaf[1]); rect(cx - 4, ground - size - 1, 2, 2, p.leaf[1]); }
      };
      tree(hall.x - 6, 8); tree(tx + 8, 6);
      [hall.x - 14, hall.x + 8, ax + 6].forEach((lx, i) => {
        if (lx < 2) return;
        rect(lx, ground - 6, 1, 9, p.dark); rect(lx - 1, ground - 8, 3, 2, p.lit);
        c.fillStyle = 'rgba(' + p.glow + ',' + (.14 + .1 * Math.abs(Math.sin(t * 1.3 + i))) + ')';
        c.fillRect((lx - 4) * u, (ground - 11) * u, 9 * u, 8 * u);
      });
      // falling snow (light) or ginkgo leaves (dark), then touch sparks
      this.flakes.forEach(flake => {
        flake.y += flake.v; flake.x += Math.sin(t + flake.sway) * .15 - (p.snow ? 0 : .12);
        if (flake.y > ground + 4) { flake.y = -1; flake.x = Math.random() * cols; }
        if (flake.x < 0) flake.x += cols;
        c.globalAlpha = p.snow ? .9 : .8; rect(flake.x, flake.y, 1, 1, p.flake);
      });
      this.sparks = this.sparks.filter(spark => spark.life-- > 0);
      this.sparks.forEach(spark => { spark.x += spark.vx; spark.y += spark.vy; c.globalAlpha = spark.life / 10; rect(spark.x, spark.y, 1, 1, p.star); });
      c.globalAlpha = 1;
      // legibility shade over the copy side (stepped, not a blur)
      [[.5, .5], [.62, .3], [.74, .14]].forEach(step => { c.fillStyle = 'rgba(29,20,48,' + step[1] + ')'; c.fillRect(0, 0, this.width * step[0], this.height * .7); });
    },
  },
});
