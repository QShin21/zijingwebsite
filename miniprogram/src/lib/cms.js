const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const http = require('./http');
const config = require('../config');
const { card } = require('./format');
const v2 = require('./v2');
const images = require('./v2-images');
const collections = ['events', 'announcements', 'games', 'teams', 'seasons', 'honors', 'news', 'albums', 'recruitment', 'pages'];
const fields = ['title', 'slug', 'summary', 'body', 'cover', 'demo', 'type', 'kind', 'game', 'team', 'season', 'startAt', 'endAt',
  'location', 'date', 'competition', 'division', 'placing', 'sourceURL', 'verified', 'requirements', 'contact', 'channelCheckedAt',
  'qrCode', 'event', 'members', 'positions', 'photos', 'sections', 'archived', 'lifecycle', 'registrationClosed',
  'registrationStart', 'registrationEnd', 'registrationURL', 'channelText', '_status', 'publishedAt', 'createdAt'];
function query(values) {
  return Object.keys(values).filter(key => values[key] !== undefined && values[key] !== '').map(key =>
    `${encodeURIComponent(key)}=${encodeURIComponent(String(values[key]))}`).join('&');
}
function selection(names) { return Object.fromEntries(names.map(name => [`select[${name}]`, true])); }
function contentQuery(collection, options = {}) {
  if (!collections.includes(collection)) throw new Error(i18n.t('栏目无效', 'Invalid section.'));
  return { depth: 0, draft: false, page: options.page || 1, limit: Math.min(options.limit || 12, 50),
    sort: collection === 'games' ? 'sort' : options.sort || '-createdAt',
    'where[_status][equals]': 'published',
    ...(collection === 'honors' ? { 'where[verified][equals]': true } : {}),
    ...selection(fields),
    ...(options.slug ? { 'where[slug][equals]': options.slug } : {}),
    ...(options.id ? { 'where[id][equals]': options.id } : {}),
    ...(options.key ? { 'where[key][equals]': options.key } : {}),
    ...(options.game ? { 'where[game][equals]': options.game } : {}),
    ...(options.team ? { 'where[team][equals]': options.team } : {}),
    ...(options.kind ? { 'where[kind][equals]': options.kind } : {}),
    ...(options.type ? { 'where[type][equals]': options.type } : {}),
    ...(options.year ? { 'where[date][greater_than_equal]': `${options.year}-01-01T00:00:00+08:00`,
      'where[date][less_than]': `${Number(options.year) + 1}-01-01T00:00:00+08:00` } : {}),
    ...(options.search ? { 'where[title][contains]': options.search.trim() } : {}),
  };
}
function publicProjection(doc) {
  const value = { id: doc.id };
  fields.forEach(field => { if (doc[field] !== undefined) value[field] = doc[field]; });
  if (value.members) value.members = value.members.filter(member => member.consent === true)
    .map(member => ({ displayName: member.displayName, position: member.position }));
  return value;
}
async function list(collection, options = {}) {
  if (collection === 'announcements') return notices(options);
  if (collection === 'pages' && options.key) {
    const page = await fixed(options.key);
    return { docs: page.updatedAt ? [card({ ...page, _status: 'published' }, collection)] : [], page: 1, hasNextPage: false };
  }
  const data = await http.request(`/api/${collection}?${query(contentQuery(collection, options))}`, { required: true });
  if (!data || !Array.isArray(data.docs)) throw new Error(i18n.t('栏目数据暂不可用', 'Section data is unavailable.'));
  const docs = data.docs.filter(doc => doc._status === 'published' && (collection !== 'honors' || doc.verified === true));
  return { docs: docs.map(doc => card(publicProjection(doc), collection)), hasNextPage: Boolean(data.hasNextPage), page: data.page || 1, totalDocs: data.totalDocs || 0 };
}
async function detail(collection, id, slug) {
  const result = await list(collection, { id, slug, limit: 1 });
  if (!result.docs[0]) throw new Error(i18n.t('内容尚未公开或已移除', 'This content is not public or has been removed.'));
  return result.docs[0];
}
async function media(id) {
  if (!id) return null;
  const key = typeof id === 'object' ? id.id : id;
  try {
    const data = await http.request(`/api/media/${encodeURIComponent(key)}?depth=0&${query(selection(['url', 'alt', 'credit', 'sizes']))}`, { required: true });
    const path = data.sizes && data.sizes.card && data.sizes.card.url || data.url || '';
    const url = /^\/(?!\/)/.test(path) ? config.origin + path : path;
    // Media hosted elsewhere needs an explicit allowlist and domain configuration.
    if (!url.startsWith(config.origin + '/')) return null;
    const image = await images.media({ src: url.slice(config.origin.length), alt: data.alt });
    return image ? { ...image, credit: data.credit || '' } : null;
  } catch { return null; }
}
async function decorate(docs) {
  return Promise.all(docs.map(async doc => ({ ...doc, coverImage: doc.coverImage || await media(doc.cover) })));
}
function socialQuery(options = {}) {
  return { depth: 0, limit: options.limit || 20, page: options.page || 1, sort: options.sort || '-createdAt',
    ...(options.game ? { 'where[game][equals]': options.game } : {}),
    ...(options.targetType ? { 'where[targetType][equals]': options.targetType } : {}),
    ...(options.targetId ? { 'where[targetId][equals]': options.targetId } : {}),
    ...(options.category ? { 'where[category][equals]': options.category } : {}),
    ...selection(options.fields || ['title', 'body', 'game', 'authorName', 'createdAt', 'status', 'category', 'videoURL', 'images', 'reviewNote']),
    ...(options.visible === false ? {} : { 'where[status][equals]': 'visible' }) };
}
const socials = ['community-posts', 'community-showcase'];
async function social(collection, options = {}) {
  if (!socials.includes(collection)) throw new Error(i18n.t('内容类型无效', 'Invalid content type.'));
  return http.request(`/api/${collection}?${query(socialQuery(options))}`, { required: true });
}
async function socialDetail(collection, id) {
  if (!socials.includes(collection)) throw new Error(i18n.t('内容类型无效', 'Invalid content type.'));
  const detailFields = ['title', 'body', 'game', 'authorName', 'createdAt', 'status', 'category', 'videoURL', 'images'];
  if (collection === 'community-posts') detailFields.push('startAt', 'endAt', 'location');
  const value = await http.request(`/api/${collection}/${encodeURIComponent(id)}?depth=0&${query(selection(detailFields))}`, { required: true });
  if (value.status !== 'visible') throw new Error(i18n.t('内容暂不可用', 'This content is not available right now.'));
  return { ...value, collection };
}
async function eventDetail(ref, collection) {
  const source = collection === 'events' ? 'club' : 'community';
  const detail = await v2.get('events/' + source + '/' + encodeURIComponent(ref));
  const event = detail.event, registration = detail.registration || {};
  return {
    doc: card({ id: event.ref.id, slug: event.ref.slug, title: event.title, summary: event.summary,
      body: detail.body || detail.bodyText, game: event.community, type: event.category, demo: event.demo,
      startAt: event.startAt, endAt: event.endAt, location: event.location, publishedAt: event.publishedAt,
      category: 'event', _status: 'published', archived: event.archived, lifecycle: event.state,
      registrationStart: event.signup.opensAt, registrationEnd: event.signup.deadline,
      registrationURL: registration.url, channelText: registration.channelText, contact: registration.contact,
      requirements: registration.requirements, channelCheckedAt: registration.checkedAt }, collection),
    cover: event.cover, qr: registration.qrCode, images: detail.images, presentation: detail.presentation,
  };
}
async function articleDetail(ref, collection) {
  const community = collection === 'community-posts';
  const kind = community ? 'communityNotice' : collection === 'news' ? 'news' : 'announcement';
  const detail = await v2.get('articles/' + kind + '/' + encodeURIComponent(ref), {}, collection === 'news' ? { required: true } : undefined);
  const article = detail.article;
  return {
    doc: card({ id: article.ref.id, slug: article.ref.slug, title: article.title, summary: article.summary,
      body: detail.body || detail.bodyText, game: article.community, demo: article.demo, publishedAt: article.publishedAt,
      category: community ? 'notice' : undefined, _status: 'published' }, collection),
    cover: article.cover, images: detail.images, presentation: detail.presentation,
  };
}
function publishedDetail(collection, id, slug, category) {
  const ref = id || slug;
  if (collection === 'events') return eventDetail(ref, collection);
  // English readers get news through the V2 article read, which carries cached English.
  if (collection === 'news') return articleDetail(ref, collection);
  if (collection === 'announcements' || category === 'notice') return articleDetail(ref, collection);
  if (category === 'event') return eventDetail(ref, collection);
  // Older community share links only include an ID.
  return eventDetail(ref, collection).catch(cause => {
    if (cause?.status !== 404) throw cause;
    return articleDetail(ref, collection);
  });
}
function fixed(key) {
  return http.request('/api/v2/pages/' + encodeURIComponent(key), key === 'privacy' ? { auth: false, raw: true } : {});
}
async function notices(options) {
  const read = (page, limit) => v2.get('feed', { kind: 'announcements', page, limit });
  const page = options.page || 1, limit = options.limit || 12;
  const search = options.search?.trim().toLowerCase();
  let data = await read(search ? 1 : page, search ? 50 : limit);
  if (search) {
    const all = data.docs.slice();
    while (data.hasNextPage) {
      data = await read(data.page + 1, 50);
      all.push(...data.docs);
    }
    const matching = all.filter(({ item }) => item.title.toLowerCase().includes(search));
    data = { docs: matching.slice((page - 1) * limit, page * limit), page, hasNextPage: matching.length > page * limit, totalDocs: matching.length };
  }
  const docs = await Promise.all(data.docs.map(async ({ item }) => {
    const target = v2.article(item);
    return card({ id: target.params.id, slug: target.params.slug, title: item.title, summary: item.summary,
      publishedAt: item.publishedAt, kindText: item.label, demo: item.demo,
      coverImage: await images.media(item.cover) }, target.params.collection);
  }));
  return { ...data, docs };
}
module.exports = { list, detail, publishedDetail, fixed, media, decorate, social, socialDetail, query, selection, contentQuery, publicProjection };
