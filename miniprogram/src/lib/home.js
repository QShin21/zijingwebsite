const cms = require('./cms');
const session = require('./session');
const club = require('./club');
const native = require('./native-presentation');
const { error, labels } = require('./page');
const defaults = ['events', 'teams', 'honors', 'news', 'albums'];
async function load(page) {
    const ticket = page._ticket = (page._ticket || 0) + 1;
    const user = session.user();
    page.setData({ loading: true, error: '', user, modules: [], staffBatches: [], promotions: {}, clubError: '' });
    try {
      const site = await cms.site();
      const kinds = user ? (site.modules.length ? site.modules.filter(module => module.enabled).map(module => module.kind) : defaults)
        : ['events'];
      const modules = await Promise.all(kinds.filter(kind => labels[kind]).map(async kind => {
        const configured = site.modules.find(module => module.kind === kind);
        try {
          let result = await cms.list(kind, { limit: 3 });
          const featured = kind === 'events' ? site.featuredEvents : kind === 'honors' ? site.featuredHonors : [];
          if (featured.length) {
            const selected = await Promise.all(featured.slice(0, 3).map(id => cms.detail(kind, typeof id === 'object' ? id.id : id).catch(() => null)));
            const valid = selected.filter(Boolean);
            if (valid.length) result = { docs: valid };
          }
          return { kind, title: configured && configured.title || labels[kind], docs: (await cms.decorate(result.docs)).map(native.content) };
        } catch (cause) { return { kind, title: labels[kind], docs: [], error: cause.message }; }
      }));
      const notices = await cms.list('announcements', { limit: 2 });
      const hero = await cms.media(site.heroImage);
      if (ticket !== page._ticket) return;
      page.setData({ loading: false, site, modules, hero, announcements: notices.docs,
        showJoin: user && (!site.modules.length || site.modules.some(module => module.kind === 'join' && module.enabled)),
        showAbout: user && (!site.modules.length || site.modules.some(module => module.kind === 'about' && module.enabled)) });
      await loadClub(page, ticket);
    } catch (cause) { if (ticket === page._ticket) error(page, cause); }
  }
async function loadClub(page, ticket = page._ticket) {
  page.setData({ clubError: '' });
  try {
    const value = await club.load();
    if (ticket === page._ticket) page.setData({ staffBatches: value.staffBatches.map(batch => ({ ...batch, params: { kind: 'staff', id: batch.id } })), promotions: value.promotions });
  } catch (cause) { if (ticket === page._ticket) page.setData({ clubError: cause.message }); }
}
module.exports = { load, loadClub };

