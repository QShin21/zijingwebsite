// Image resolution for V2 views.
// - Media-library files load with the current credential when signed in.
// - Controlled /api/v2/images/* sources need the account: signed-in reads exchange
//   them in batches (≤ 20) for short-lived signed URLs bound to the current session
//   (POST /api/v2/images/sign); every GET is still authorized by the server.
// A signed URL is a bearer credential for ONE image: kept in memory only, never
// persisted or logged, dropped at expiry and on any account change. Decoding
// happens on the device.
const config = require('../config');
const http = require('./http');
const session = require('./session');
const BATCH = 20;
const MARGIN = 5000; // re-sign 5 s before a ticket expires
let signed = {}; // src -> { url, expires }
let waiting = []; // [{ src, resolve }]
let scheduled = false;
let generation = 0; // bumps on account change; late signing replies are dropped

function key(src) { return 'i' + String(src).replace(/[^a-zA-Z0-9]/g, '_').slice(-120); }
function controlled(src) { return /^\/api\/v2\/images\//.test(src); }
function fresh(entry) { return Boolean(entry) && entry.expires - MARGIN > Date.now(); }

function sign(sources, run) {
  return http.request('/api/v2/images/sign', { method: 'POST', data: { sources }, required: true }).then(result => {
    if (run !== generation || !result) return;
    const fallback = Date.parse(result.expiresAt) || 0;
    (Array.isArray(result.images) ? result.images : []).forEach(image => {
      if (!image || sources.indexOf(image.src) < 0 || typeof image.url !== 'string') return;
      // Only the same controlled path with a ticket appended is accepted.
      if (image.url.indexOf(image.src + '&ticket=') !== 0) return;
      const expires = Date.parse(image.expiresAt) || fallback;
      if (expires > Date.now()) signed[image.src] = { url: config.origin + image.url, expires };
    });
  }, () => undefined);
}
function flush() {
  scheduled = false;
  const jobs = waiting, run = generation;
  waiting = [];
  const sources = [];
  jobs.forEach(job => { if (sources.indexOf(job.src) < 0) sources.push(job.src); });
  for (let index = 0; index < sources.length; index += BATCH) {
    const batch = sources.slice(index, index + BATCH);
    // Each batch settles its own jobs (duplicates included) as soon as it is signed, so long
    // lists render progressively; `sign` never rejects, and an account change in between
    // (generation bump) resolves the batch's jobs with '' instead of an old ticket.
    sign(batch, run).then(() => {
      jobs.forEach(job => {
        if (batch.indexOf(job.src) < 0) return;
        const entry = run === generation ? signed[job.src] : null;
        job.resolve(fresh(entry) ? entry.url : '');
      });
    });
  }
}
function load(src) {
  if (typeof src !== 'string' || !/^\/(?!\/)/.test(src)) return Promise.resolve('');
  if (!session.token()) return Promise.resolve(config.origin + src);
  if (src.startsWith('/api/media/file/')) {
    const run = generation;
    return http.download(src).then(path => run === generation ? path : '', () => '');
  }
  if (!controlled(src)) return Promise.resolve(config.origin + src);
  const entry = signed[src];
  if (fresh(entry)) return Promise.resolve(entry.url);
  delete signed[src];
  return new Promise(resolve => {
    waiting.push({ src, resolve });
    if (!scheduled) { scheduled = true; Promise.resolve().then(flush); }
  });
}
/**
 * Adds `coverKey` to every view with a `coverSrc`, then fills page.data.img[key]
 * progressively. `alive()` lets a page drop late results after hide/unload/reload.
 */
async function media(image) {
  if (!image) return null;
  const url = await load(image.src);
  return url ? { url, alt: image.alt || '' } : null;
}
function attach(page, views, alive) {
  const sources = page._imageSources || (page._imageSources = {});
  page._imageAlive = alive;
  const pending = new Map();
  (views || []).forEach(view => {
    if (!view || !view.coverSrc) return;
    view.coverKey = key(view.coverSrc);
    sources[view.coverKey] = view.coverSrc;
    if (!pending.has(view.coverSrc)) pending.set(view.coverSrc, load(view.coverSrc));
    pending.get(view.coverSrc).then(path => {
      if (!path || (alive && !alive())) return;
      if (page.data.img && page.data.img[view.coverKey] === path) return;
      page.setData({ ['img.' + view.coverKey]: path });
    });
  });
  return views;
}
/**
 * <image binderror>: re-sign a controlled image once (its ticket may have expired
 * before a lazy image loaded); otherwise clear it so the card shows its text crest.
 * Events from hidden pages or for an older URL are ignored.
 */
function failed(page, event) {
  const dataset = (event && event.currentTarget && event.currentTarget.dataset) || {};
  const coverKey = dataset.key;
  if (!coverKey || (page._imageAlive && !page._imageAlive())) return;
  const shown = page.data.img && page.data.img[coverKey];
  if (!shown || (dataset.url && dataset.url !== shown)) return;
  const src = page._imageSources && page._imageSources[coverKey];
  const tries = page._imageRetries || (page._imageRetries = {});
  if (src && controlled(src) && session.token() && !tries[coverKey]) {
    tries[coverKey] = true;
    delete signed[src];
    load(src).then(url => {
      if (page._imageAlive && !page._imageAlive()) return;
      page.setData({ ['img.' + coverKey]: url && url !== shown ? url : '' });
    });
    return;
  }
  page.setData({ ['img.' + coverKey]: '' });
}
function clear() {
  generation++;
  signed = {};
  const jobs = waiting;
  waiting = [];
  jobs.forEach(job => job.resolve(''));
}
// Account changes invalidate every signed URL (logout or identity switch).
session.subscribe(() => clear());
module.exports = { key, load, media, attach, failed, clear };
