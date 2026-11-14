// English text for pages that read records through the Payload REST API (lists and older
// detail views). In English mode only, the matching V2 read (same login, same server-side
// access and publication rules, cached English attached by the server) supplies the
// translated text, which replaces only title/summary/body text of records already on the
// page, matched by id. No record is added, nothing is written, and no translation work is
// created: the server only attaches English that was produced when the content was published.
const v2 = require('./v2');
const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { locale: () => 'zh' }; })();

const english = () => i18n.locale() === 'en';
// V2 list endpoint and how to read id/title/summary from each item.
const lists = {
  news: { path: 'feed', query: { kind: 'news' }, pick: entry => entry.kind === 'article' && entry.item && entry.item.ref && entry.item.ref.type === 'news' ? { id: entry.item.ref.id, title: entry.item.title, summary: entry.item.summary } : null },
  albums: { path: 'feed', query: { kind: 'albums' }, pick: entry => entry.kind === 'article' && entry.item && entry.item.ref && entry.item.ref.type === 'album' ? { id: entry.item.ref.id, title: entry.item.title, summary: entry.item.summary } : null },
  games: { path: 'communities', query: {}, pick: card => card && card.community ? { id: card.community.id, title: card.community.title, summary: card.summary } : null },
  teams: { path: 'teams', query: {}, pick: card => card && card.team ? { id: card.team.id, title: card.team.title, summary: card.summary } : null },
  // Verified legacy honors: V2 honor cards carry key "honors:<id>"; summary is shown as description.
  honors: { path: 'honors', query: {}, pick: card => { const match = card && typeof card.key === 'string' ? /^honors:(\d+)$/.exec(card.key) : null; return match ? { id: Number(match[1]), title: card.title, summary: card.description } : null; } },
};
const MAX_PAGES = 3;

function apply(docs, found) {
  return docs.map(doc => {
    const value = found[String(doc.id)];
    if (!value) return doc;
    return { ...doc, title: value.title || doc.title, ...(typeof value.summary === 'string' && value.summary ? { summary: value.summary } : {}) };
  });
}

/** English titles/summaries for records of a REST list page (bounded: ≤ 3 V2 pages of 50). */
async function list(collection, docs) {
  const spec = lists[collection];
  if (!english() || !spec || !Array.isArray(docs) || !docs.length) return docs;
  const wanted = new Set(docs.map(doc => String(doc.id))), found = {};
  try {
    for (let page = 1; page <= MAX_PAGES && Object.keys(found).length < wanted.size; page++) {
      const result = await v2.get(spec.path, { ...spec.query, page, limit: 50 }, { required: true });
      (result.docs || []).forEach(item => {
        const value = spec.pick(item);
        if (value && wanted.has(String(value.id))) found[String(value.id)] = value;
      });
      if (!result.hasNextPage) break;
    }
  } catch { return docs; }
  return apply(docs, found);
}

// V2 detail endpoints for REST detail views; the slug is the record's own.
const details = {
  albums: doc => 'articles/album/' + encodeURIComponent(doc.slug || doc.id),
  news: doc => 'articles/news/' + encodeURIComponent(doc.slug || doc.id),
  games: doc => 'communities/' + encodeURIComponent(doc.slug),
  teams: doc => 'teams/' + encodeURIComponent(doc.slug || doc.id),
};
/** English title/summary/body for a REST detail record; `body` is the V2 rich text if any. */
async function detail(collection, doc) {
  const path = details[collection];
  if (!english() || !path || !doc || (collection === 'games' && !doc.slug)) return null;
  try {
    const value = await v2.get(path(doc), {}, { required: true });
    const card = value.article || (value.card && (value.card.community || value.card.team)) || null;
    const summary = value.article ? value.article.summary : value.card ? value.card.summary : null;
    if (!card) return null;
    return { title: card.title || doc.title, summary: summary || doc.summary, body: value.body || null };
  } catch { return null; }
}

/**
 * English captions for a REST album's photos, matched by the stable photo row id that both
 * reads expose (`photos[].id`). Ids seen more than once in the V2 pages or in the REST
 * photos are ignored, photos
 * without an id or without a match keep the original caption, and order never matters, so a
 * caption can never move to another picture. Bounded: ≤ 4 V2 pages of 50 (albums hold ≤ 200).
 */
async function captions(doc) {
  if (!english() || !doc || !Array.isArray(doc.photos) || !doc.photos.length || !(doc.slug || doc.id)) return null;
  const found = {}, duplicate = {};
  try {
    for (let page = 1; page <= 4; page++) {
      const value = await v2.get('articles/album/' + encodeURIComponent(doc.slug || doc.id), { page, photoLimit: 50 }, { required: true });
      const photos = value && value.photos;
      if (!photos || !Array.isArray(photos.docs)) break;
      photos.docs.forEach(photo => {
        if (!photo || typeof photo.id !== 'string' || !photo.id) return;
        if (Object.prototype.hasOwnProperty.call(found, photo.id)) duplicate[photo.id] = true;
        found[photo.id] = photo.caption;
      });
      if (!photos.hasNextPage) break;
    }
  } catch { return null; }
  // Ids repeated in the page's own REST photos are equally ambiguous: those photos keep
  // their original captions too.
  const seen = {};
  doc.photos.forEach(photo => {
    const id = photo && typeof photo.id === 'string' ? photo.id : '';
    if (!id) return;
    if (seen[id]) duplicate[id] = true;
    seen[id] = true;
  });
  return doc.photos.map(photo => {
    const id = photo && typeof photo.id === 'string' ? photo.id : '';
    const english = id && !duplicate[id] && Object.prototype.hasOwnProperty.call(found, id) ? found[id] : null;
    return typeof english === 'string' && english ? { ...photo, caption: english } : photo;
  });
}

/** English title/body for showcase records of a REST list, via the community showcase read. */
async function showcase(slug, docs) {
  if (!english() || !slug || !Array.isArray(docs) || !docs.length) return docs;
  try {
    const result = await v2.get('communities/' + encodeURIComponent(slug) + '/showcase', { page: 1, limit: 50 }, { required: true });
    const found = {};
    (result.docs || []).forEach(card => { if (card && card.id != null) found[String(card.id)] = card; });
    return docs.map(doc => {
      const card = found[String(doc.id)];
      return card ? { ...doc, title: card.title || doc.title, body: typeof card.body === 'string' && card.body ? card.body : doc.body } : doc;
    });
  } catch { return docs; }
}

/** English titles for community events/notices of a REST list, via the community posts read. */
async function posts(slug, docs) {
  if (!english() || !slug || !Array.isArray(docs) || !docs.length) return docs;
  try {
    const result = await v2.get('communities/' + encodeURIComponent(slug) + '/posts', { page: 1, limit: 50 }, { required: true });
    const found = {};
    (result.docs || []).forEach(card => { if (card && card.ref && card.ref.id != null) found[String(card.ref.id)] = card; });
    return docs.map(doc => {
      const card = found[String(doc.id)];
      return card ? { ...doc, title: card.title || doc.title, ...(card.location ? { location: card.location } : {}) } : doc;
    });
  } catch { return docs; }
}

module.exports = { list, detail, showcase, posts, captions, MAX_PAGES };
