const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const cms = require('./cms');
const honor = require('./team-honor');
// Read only the existing published-team index and public archive endpoint.
// Raw evidence is never projected into a community card or retained in page data.
async function load(game, current = () => true) {
  const gameID = honor.id(game);
  if (!gameID) throw new Error(i18n.t('社群入口无效，请返回后重新进入', 'Invalid community link. Go back and open it again.'));
  const teams = []; let page = 1, more = true;
  while (more && current()) {
    const result = await cms.list('teams', { game: gameID, limit: 50, page });
    if (!current()) return [];
    teams.push(...result.docs);
    more = Boolean(result.hasNextPage); page++;
  }
  const pins = await Promise.all(teams.map(async team => {
    try {
      const archive = await honor.load(team.id);
      if (!current() || !archive.records.length) return null;
      const latest = archive.records[0];
      return { id: archive.team.id, title: archive.team.title, count: archive.records.length,
        latestTitle: latest.title, latestDate: latest.dateText };
    } catch (cause) { if (cause && cause.status === 404) return null; throw cause; }
  }));
  return current() ? pins.filter(Boolean) : [];
}
module.exports = { load };
