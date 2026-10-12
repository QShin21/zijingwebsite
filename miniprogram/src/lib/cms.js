const http = require('./http');
const config = require('../config');
const { card } = require('./format');
const collections = ['events', 'announcements', 'games', 'teams', 'seasons', 'honors', 'news', 'albums', 'recruitment', 'pages'];
const publicCollections = ['events', 'announcements', 'pages'];
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
  if (!collections.includes(collection)) throw new Error('栏目无效');
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
  const data = await http.request(`/api/${collection}?${query(contentQuery(collection, options))}`, {
    auth: !publicCollections.includes(collection), required: !publicCollections.includes(collection),
  });
  if (!data || !Array.isArray(data.docs)) throw new Error('栏目数据暂不可用');
  const docs = data.docs.filter(doc => doc._status === 'published' && (collection !== 'honors' || doc.verified === true));
  return { docs: docs.map(doc => card(publicProjection(doc), collection)), hasNextPage: Boolean(data.hasNextPage), page: data.page || 1, totalDocs: data.totalDocs || 0 };
}
async function detail(collection, id, slug) {
  const result = await list(collection, { id, slug, limit: 1 });
  if (!result.docs[0]) throw new Error('内容尚未公开或已移除');
  return result.docs[0];
}
async function site() {
  const raw = await http.request('/api/globals/site?depth=0', { auth: false });
  return { name: raw.name || '竞在紫荆', heroTitle: raw.heroTitle || '因热爱相遇。',
    heroSubtitle: raw.heroSubtitle || '', heroImage: raw.heroImage, heroButtonLabel: raw.heroButtonLabel || '加入紫荆',
    heroButtonURL: raw.heroButtonURL || '/join', footer: raw.footer || '', description: raw.description || '',
    contacts: (raw.contacts || []).map(contact => ({ label: contact.label, text: contact.text, url: contact.url })),
    modules: raw.modules || [], navigation: raw.navigation || [], featuredEvents: raw.featuredEvents || [], featuredHonors: raw.featuredHonors || [] };
}
const mediaCache = {};
async function media(id) {
  if (!id) return null;
  const key = typeof id === 'object' ? id.id : id;
  if (mediaCache[key]) return mediaCache[key];
  try {
    const data = await http.request(`/api/media/${encodeURIComponent(key)}?depth=0&${query(selection(['url', 'alt', 'credit', 'sizes']))}`, { auth: false });
    const path = data.sizes && data.sizes.card && data.sizes.card.url || data.url || '';
    const url = /^\/(?!\/)/.test(path) ? config.origin + path : path;
    // Media hosted elsewhere needs an explicit allowlist and domain configuration.
    if (!url.startsWith(config.origin + '/')) return null;
    mediaCache[key] = { url, alt: data.alt || '', credit: data.credit || '' };
    return mediaCache[key];
  } catch { return null; }
}
async function decorate(docs) {
  return Promise.all(docs.map(async doc => ({ ...doc, coverImage: await media(doc.cover) })));
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
  if (!socials.includes(collection)) throw new Error('内容类型无效');
  return http.request(`/api/${collection}?${query(socialQuery(options))}`, { required: true });
}
async function socialDetail(collection, id) {
  if (!socials.includes(collection)) throw new Error('内容类型无效');
  const value = await http.request(`/api/${collection}/${encodeURIComponent(id)}?depth=0&${query(selection(['title', 'body', 'game', 'authorName', 'createdAt', 'status', 'category', 'videoURL', 'images']))}`, { required: true });
  if (value.status !== 'visible') throw new Error('内容暂不可用');
  return { ...value, collection };
}
module.exports = { list, detail, site, media, decorate, social, socialDetail, query, selection, contentQuery, publicProjection };
