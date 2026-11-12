/* global Component */
// 黑曜竞技场 · original brand art rendered on the device with Canvas 2D (portrait
// composition for the native home stage). It never requests data; it pauses while
// the page is hidden or the canvas is scrolled out of view, caps at ~30 fps, and the
// page content stays complete when the canvas is unavailable (static WXSS stage).
const TAU = Math.PI * 2;
function hexagon(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    if (i === 0) c.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); else c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  c.closePath();
}
function ellipse(c, x, y, rx, ry, from, to) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  c.beginPath(); c.arc(0, 0, rx, from === undefined ? 0 : from, to === undefined ? TAU : to); c.restore();
}
Component({
  properties: { density: { type: Number, value: 1 } },
  data: { ready: false },
  lifetimes: {
    ready() { this.setup(); },
    detached() { this.stop(); this.disposed = true; if (this.observer) this.observer.disconnect(); },
  },
  pageLifetimes: {
    show() { this.hidden = false; this.start(); },
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
      const count = Math.round(Math.min(90, Math.max(28, this.width * this.height / 5200)) * (this.properties.density || 1));
      this.motes = Array.from({ length: count }, () => ({
        x: Math.random() * this.width, y: Math.random() * this.height,
        vx: (Math.random() - .5) * .08, vy: (Math.random() - .4) * .08, r: .5 + Math.random() * 1.3,
        ember: Math.random() < .14, phase: Math.random() * TAU, depth: .35 + Math.random() * .65,
      }));
    },
    start() {
      if (this.running || !this.canvas || this.hidden || this.offscreen || this.disposed) return;
      this.running = true; this.last = 0; this.painted = 0;
      const loop = time => {
        if (!this.running) return;
        if (time - this.painted >= 32) { this.painted = time; this.draw(time); }
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
      if (!point) return;
      this.pointer = { x: point.x, y: point.y, strength: 1 };
    },
    release() { if (this.pointer) this.pointer.strength = 0; },
    draw(time) {
      const c = this.context, w = this.width, h = this.height, t = time / 1000;
      const step = this.last ? Math.min(3, (time - this.last) / 16.67) : 1; this.last = time;
      const pointer = this.pointer;
      if (pointer) pointer.strength *= .96;
      c.clearRect(0, 0, w, h);
      // Composition anchor: arena centre sits lower-right, copy stays upper-left.
      const cx = w * .7, floorY = h * .9, rx = w * .66, ry = rx * .2;
      // 1 · light shafts
      c.globalCompositeOperation = 'lighter';
      const sway = Math.sin(t * .3) * w * .02;
      [[0, 10, w * .22, .5], [-.3, 6, w * .16, .22], [.24, 6, w * .14, .2]].forEach(shaft => {
        const x = cx + shaft[0] * w;
        const g = c.createLinearGradient(0, 0, 0, floorY);
        g.addColorStop(0, 'rgba(239,214,245,' + shaft[3] + ')');
        g.addColorStop(.55, 'rgba(163,86,184,' + shaft[3] * .32 + ')');
        g.addColorStop(1, 'rgba(102,8,116,0)');
        c.fillStyle = g; c.beginPath();
        c.moveTo(x + sway - shaft[1], -10); c.lineTo(x + sway + shaft[1], -10); c.lineTo(x + shaft[2], floorY); c.lineTo(x - shaft[2], floorY);
        c.closePath(); c.fill();
      });
      c.globalCompositeOperation = 'source-over';
      // 2 · competition floor: glow, dial ticks, rings and a gold scan arc
      const floor = c.createRadialGradient(cx, floorY, 0, cx, floorY, rx);
      floor.addColorStop(0, 'rgba(58,28,74,0.9)'); floor.addColorStop(.7, 'rgba(18,14,27,0.6)'); floor.addColorStop(1, 'rgba(8,7,13,0)');
      c.fillStyle = floor; ellipse(c, cx, floorY, rx * 1.08, ry * 1.08); c.fill();
      c.lineWidth = 6; c.strokeStyle = 'rgba(239,231,246,0.24)'; c.setLineDash([1.5, 14]);
      ellipse(c, cx, floorY, rx * .92, ry * .92); c.stroke(); c.setLineDash([]);
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(239,231,246,0.5)'; ellipse(c, cx, floorY, rx * .84, ry * .84); c.stroke();
      c.strokeStyle = 'rgba(163,86,184,0.6)'; ellipse(c, cx, floorY, rx * .62, ry * .62); c.stroke();
      c.lineWidth = 2; c.strokeStyle = 'rgba(239,231,246,0.75)'; ellipse(c, cx, floorY, rx * .44, ry * .44); c.stroke();
      const sweep = (t * .7) % TAU;
      c.lineWidth = 2.4; c.strokeStyle = 'rgba(240,192,96,0.95)'; c.lineCap = 'round';
      ellipse(c, cx, floorY, rx * .74, ry * .74, sweep, sweep + .5); c.stroke(); c.lineCap = 'butt';
      // 3 · brushed-metal monoliths with silver rim light
      const slab = (x, top, width, height, lean, rimLeft) => {
        const g = c.createLinearGradient(x, 0, x + width, 0);
        g.addColorStop(0, '#2d2839'); g.addColorStop(.5, '#14121c'); g.addColorStop(1, '#09080e');
        c.fillStyle = g; c.beginPath();
        c.moveTo(x, top + lean); c.lineTo(x + width, top); c.lineTo(x + width + 4, top + height); c.lineTo(x + 4, top + height + lean); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(246,241,251,0.75)'; c.lineWidth = 1.4; c.beginPath();
        if (rimLeft) { c.moveTo(x, top + lean); c.lineTo(x + 4, top + height + lean); } else { c.moveTo(x + width, top); c.lineTo(x + width + 4, top + height); }
        c.stroke();
      };
      // Portrait composition (matches the web ≤640px art): a single monolith kept inside the right edge.
      slab(cx + w * .16, h * .5, w * .1, h * .36, -10, true);
      // 4 · small complete brand plate resting above the floor centre (never cropped, clear of the copy)
      const pr = Math.min(w, h) * .085, px = cx - w * .04, py = floorY - ry * .2 - pr * 1.25 + Math.sin(t * .9) * 3;
      const halo = c.createRadialGradient(px, floorY - 4, 0, px, floorY - 4, pr * 1.6);
      halo.addColorStop(0, 'rgba(214,155,227,0.32)'); halo.addColorStop(1, 'rgba(214,155,227,0)');
      c.fillStyle = halo; ellipse(c, px, floorY - 4, pr * 1.6, pr * .3); c.fill();
      const plate = c.createLinearGradient(px, py - pr, px, py + pr);
      plate.addColorStop(0, '#241b31'); plate.addColorStop(1, '#0c0a12');
      hexagon(c, px, py, pr); c.fillStyle = plate; c.fill();
      const rim = c.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
      rim.addColorStop(0, '#f8e0a0'); rim.addColorStop(.5, '#d4a03c'); rim.addColorStop(1, '#7d5714');
      c.strokeStyle = rim; c.lineWidth = 3; c.stroke();
      hexagon(c, px, py, pr * .8); c.strokeStyle = 'rgba(163,86,184,0.85)'; c.lineWidth = 1; c.stroke();
      const z = pr * .36;
      c.strokeStyle = '#f6f1fb'; c.lineWidth = Math.max(4, pr * .12); c.lineJoin = 'miter'; c.lineCap = 'square';
      c.beginPath(); c.moveTo(px - z, py - z * .82); c.lineTo(px + z * .9, py - z * .82); c.lineTo(px - z * .95, py + z * .86); c.lineTo(px + z * 1.05, py + z * .86); c.stroke();
      c.lineCap = 'butt';
      // 5 · light dust following the shafts
      c.globalCompositeOperation = 'lighter';
      for (const m of this.motes) {
        if (pointer && pointer.strength > .05) {
          const dx = m.x - pointer.x, dy = m.y - pointer.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100 && d > .1) { const push = (1 - d / 100) * .04 * pointer.strength; m.vx += dx / d * push; m.vy += dy / d * push; }
        }
        m.vx = m.vx * .99 + (Math.random() - .5) * .002;
        m.vy = m.ember ? m.vy * .99 - .0012 : m.vy * .99 + (Math.random() - .5) * .002;
        m.x += m.vx * step * m.depth; m.y += m.vy * step * m.depth;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        if (m.y > h + 10) m.y = -10;
        if (m.x < -10) m.x = w + 10; if (m.x > w + 10) m.x = -10;
        const spread = w * (.1 + .2 * (m.y / h)), lit = Math.max(.15, Math.exp(-((m.x - cx) * (m.x - cx)) / (2 * spread * spread)));
        const alpha = (m.ember ? .7 : .55) * (.6 + .4 * Math.sin(t * .9 + m.phase)) * lit * m.depth;
        c.fillStyle = m.ember ? 'rgba(240,192,96,' + alpha + ')' : 'rgba(239,214,245,' + alpha + ')';
        c.beginPath(); c.arc(m.x, m.y, m.r * (.6 + m.depth * .6), 0, TAU); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      // 6 · legibility veil for the copy (upper-left)
      const veil = c.createLinearGradient(0, 0, w * .8, h * .55);
      veil.addColorStop(0, 'rgba(8,7,13,0.78)'); veil.addColorStop(.6, 'rgba(8,7,13,0.28)'); veil.addColorStop(1, 'rgba(8,7,13,0)');
      c.fillStyle = veil; c.fillRect(0, 0, w, h);
    },
  },
});
