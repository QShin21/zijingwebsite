/* global Component */
// Decorative stage light rendered on the device with Canvas 2D. It never
// requests data; it pauses while hidden or scrolled out of view, and the page
// content stays complete when the canvas is unavailable.
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
          this.seed(); this.setData({ ready: true });
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
      const count = Math.round(Math.min(160, Math.max(48, this.width * this.height / 2600)) * (this.properties.density || 1));
      this.sparks = Array.from({ length: count }, () => ({
        x: Math.random() * this.width, y: Math.random() * this.height,
        vx: (Math.random() - .5) * .18, vy: -(.08 + Math.random() * .3), r: .6 + Math.random() * 1.8,
        lime: Math.random() < .26, phase: Math.random() * Math.PI * 2,
      }));
    },
    start() {
      if (this.running || !this.canvas || this.hidden || this.offscreen || this.disposed) return;
      this.running = true; this.last = 0;
      const loop = time => {
        if (!this.running) return;
        this.draw(time);
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
      if (pointer) pointer.strength *= .985;
      c.clearRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      const sx = w * (.62 + .26 * Math.sin(t * .21)), sy = h * (.4 + .22 * Math.cos(t * .17));
      const light = c.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * .6);
      light.addColorStop(0, 'rgba(140,104,255,0.24)'); light.addColorStop(.5, 'rgba(90,43,230,0.08)'); light.addColorStop(1, 'rgba(90,43,230,0)');
      c.fillStyle = light; c.fillRect(0, 0, w, h);
      const link = 84, reach = 120;
      for (const s of this.sparks) {
        if (pointer && pointer.strength > .05) {
          const dx = s.x - pointer.x, dy = s.y - pointer.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < reach && d > .1) { const push = (1 - d / reach) * .08 * pointer.strength; s.vx += dx / d * push; s.vy += dy / d * push; }
        }
        s.vx = s.vx * .985 + (Math.random() - .5) * .004; s.vy = s.vy * .985 - .0022;
        s.x += s.vx * step; s.y += s.vy * step;
        if (s.y < -10) { s.y = h + 10; s.x = Math.random() * w; s.vy = -(.08 + Math.random() * .3); }
        if (s.x < -10) s.x = w + 10; if (s.x > w + 10) s.x = -10;
        const twinkle = .55 + .45 * Math.sin(t * 1.6 + s.phase);
        c.fillStyle = s.lime ? 'rgba(197,240,74,' + (.55 * twinkle) + ')' : 'rgba(190,172,255,' + (.6 * twinkle) + ')';
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
      }
      c.lineWidth = .7;
      for (let i = 0; i < this.sparks.length; i++) {
        const a = this.sparks[i];
        for (let j = i + 1; j < this.sparks.length; j++) {
          const b = this.sparks[j], dx = a.x - b.x, dy = a.y - b.y;
          if (dx > link || dx < -link || dy > link || dy < -link) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < link) { c.strokeStyle = 'rgba(165,140,255,' + (.16 * (1 - d / link)) + ')'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
        }
      }
      c.globalCompositeOperation = 'source-over';
    },
  },
});
