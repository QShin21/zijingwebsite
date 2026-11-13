/* global Component */
// Campus scenery behind stage headers (2026-11-13). A bundled landmark illustration over a
// CSS-drawn sky that is always present, so a failed or slow image never leaves a blank block.
// Light effects are WXSS animations only (transform/opacity): no timers, no canvas, no requests.
// They pause while the page is hidden or the scenery is off screen, and stop when detached.
const formats = ['.webp', '.jpg'];
// Fixed positions keep the first paint identical between visits.
const motes = [[8, 18, 8, 0, 9], [21, 52, 6, 2.5, 11], [34, 12, 10, 5, 8], [47, 64, 6, 1.2, 12], [58, 28, 8, 6.4, 10],
  [69, 8, 6, 3.3, 9], [78, 46, 10, 7.1, 13], [88, 22, 6, 4.2, 10], [94, 60, 8, 8.6, 11], [15, 76, 6, 9.4, 12]]
  .map((mote, index) => ({ index, x: mote[0], y: mote[1], size: mote[2], delay: mote[3], duration: mote[4] }));
Component({
  properties: {
    scene: { type: String, value: '', observer() { this.reset(); } },
    palette: { type: String, value: 'light' },
    variant: { type: String, value: 'banner' },
  },
  data: { src: '', fallback: false, loaded: false, paused: false, motes },
  lifetimes: {
    attached() { this.reset(); },
    ready() {
      try {
        this.observer = this.createIntersectionObserver();
        this.observer.relativeToViewport().observe('#zj-campus', result => {
          this.offscreen = !(result.intersectionRatio > 0);
          this.sync();
        });
      } catch { /* Without an observer the page lifetimes still pause the scenery. */ }
    },
    detached() { if (this.observer) this.observer.disconnect(); this.observer = null; },
  },
  pageLifetimes: {
    show() { this.pageHidden = false; this.sync(); },
    hide() { this.pageHidden = true; this.sync(); },
  },
  methods: {
    reset() {
      const scene = this.properties.scene;
      this.attempt = 0;
      this.setData({ src: scene, fallback: false, loaded: false });
    },
    sync() {
      const paused = Boolean(this.pageHidden || this.offscreen);
      if (paused !== this.data.paused) this.setData({ paused });
    },
    shown() { if (!this.data.loaded) this.setData({ loaded: true }); },
    // Try the JPEG copy once, then keep the drawn sky.
    failed() {
      const scene = this.properties.scene;
      this.attempt = (this.attempt || 0) + 1;
      const next = formats[this.attempt];
      if (next && scene.endsWith(formats[0])) this.setData({ src: scene.slice(0, -formats[0].length) + next, loaded: false });
      else this.setData({ src: '', fallback: true, loaded: false });
    },
  },
});
