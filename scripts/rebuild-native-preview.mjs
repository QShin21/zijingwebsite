/** Read-only WXML browser layout mapping. This is NOT an official WeChat compiler/SDK. */
/* global document, getComputedStyle, innerWidth */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { setTimeout, clearTimeout, setInterval, clearInterval } from 'node:timers';
import { chromium } from '@playwright/test';

const repository = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(repository, 'miniprogram/src');
const output = path.join(repository, '.data/rebuild-native-preview');
const browserPath = path.join(repository, '.data/visual-direction-browsers-20261013/chromium-1208/chrome-linux64/chrome');
const label = 'WXML 浏览器映射 · 合成数据 · 非官方微信或真机';
const sourceFiles = new Map();
const read = file => {
  const source = fs.readFileSync(file, 'utf8');
  if (sourceFiles.has(file) && sourceFiles.get(file) !== source) throw new Error('Source changed during browser mapping: ' + file);
  sourceFiles.set(file, source);
  return source;
};
const playwrightVersion = JSON.parse(fs.readFileSync(path.join(repository, 'node_modules/@playwright/test/package.json'), 'utf8')).version;
const native = name => path.join(sourceRoot, name);
const htmlEscape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const clone = value => JSON.parse(JSON.stringify(value));
fs.mkdirSync(output, { recursive: true });

// Evaluate actual native JS modules only to obtain Page data and pure projection functions.
// No lifecycle, business event, real storage, network, media or permission API is executed.
function runtime(theme) {
  const modules = new Map(); let definition;
  const blocked = operation => () => { throw new Error('Browser mapping forbids wx.' + operation); };
  const wx = new Proxy({ getStorageSync: key => key === 'zijing_theme' ? theme : undefined }, {
    get(target, property) { return property in target ? target[property] : blocked(String(property)); },
  });
  function load(filename) {
    const file = path.resolve(filename.endsWith('.js') ? filename : filename + '.js');
    if (!file.startsWith(sourceRoot + path.sep)) throw new Error('Refusing non-native module: ' + file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    vm.runInNewContext(read(file), { module, exports: module.exports, wx, Page: value => { definition = value; },
      require: name => { if (!name.startsWith('.')) throw new Error('No external native modules allowed'); return load(path.resolve(path.dirname(file), name)); },
      getApp: () => ({ globalData: {} }), getCurrentPages: () => [], setTimeout, clearTimeout, setInterval, clearInterval,
    }, { filename: file, timeout: 2000 });
    return module.exports;
  }
  return { load, page(name) { definition = undefined; load(native('pages/' + name + '/index.js')); if (!definition) throw new Error('Page not found: ' + name); return clone(definition.data); } };
}

function fixtureSet(rt) {
  const questionnaire = rt.load(native('lib/questionnaire.js'));
  const honor = rt.load(native('lib/team-honor-workflow.js'));
  const user = { id: 900001, name: '合成预览用户', email: '', roles: ['member'], accountStatus: 'active' };
  const content = (id, title, collection = 'events') => ({ id, collection, title, slug: 'synthetic-' + id,
    kindText: collection === 'events' ? '交流活动' : '社团通知', dateText: '2026年10月18日',
    statusText: collection === 'events' ? '报名开放' : '', summary: '合成内容仅用于检查原生页面排版，不代表真实活动安排。', location: '合成地点', coverImage: null });
  const form = questionnaire.normalizeSignup({ enabled: true, intro: '合成问卷，仅用于本地布局检查。', pageSize: 4, questions: [
    { id: 'nickname', label: '希望在活动中使用的昵称', type: 'text', required: true, options: [], maxLength: 40 },
    { id: 'direction', label: '你希望参加哪类交流？', type: 'single', required: true, options: ['观赛交流', '战术复盘与经验分享', '新成员交流'] },
    { id: 'interests', label: '你关心的内容', type: 'multiple', required: false, options: ['活动时间安排', '组队与训练', '社区组织'] },
    { id: 'notes', label: '补充说明', type: 'textarea', required: false, options: [], help: '不需要填写真实姓名、学号或联系方式。', maxLength: 500 },
  ] });
  const answers = { nickname: '合成预览昵称', direction: '战术复盘与经验分享', interests: ['组队与训练'], notes: '' };
  const entry = honor.row({ id: 900031, revision: 2, state: 'pending', team: 900052, game: 900011, season: null,
    title: '合成赛事成果：一份待核对的荣誉投稿', authorName: '合成投稿者', competition: '本地合成赛事', placing: '示例成果（合成）', date: '2026-10-12',
    description: '合成投稿文字，用于检查审核清单、反馈输入与按钮换行。', reviewNote: '', images: [], imageCount: 0,
    videoHref: '', actions: { edit: false, save: false, submit: false, withdraw: false, hide: false, reviewActions: ['approve', 'return', 'reject'] } });
  return [
    { name: 'home', page: 'home', state: '已登录首页，真实模板＋合成公告和活动', data: {
      loading: false, error: '', user, hero: null, site: { name: '竞在紫荆', heroTitle: '同场相逢，\n并肩而行。', heroSubtitle: '合成内容预览：从一场活动、一个社群开始，记录赛场与日常。', footer: '合成内容预览 · 无生产写入', description: '此处仅使用合成资料检验版式。', navigation: [] },
      announcements: [content(900002, '合成通知：活动报名与参与说明', 'announcements')], modules: [{ kind: 'events', title: '近期活动', docs: [content(900010, '合成活动：一起复盘一场精彩比赛'), content(900012, '合成活动：新成员交流与组队')] }],
      showJoin: true, showAbout: false, staffBatches: [], promotions: { event: [], notice: [], showcase: [] }, clubError: '',
    } },
    { name: 'community-contact', page: 'community', state: '无授权名片＋已有好友申请报告，待人工确认', data: {
      loading: false, needsLogin: false, error: '', game: { id: 900011, slug: 'synthetic-game', title: '合成游戏社群', summary: '本地合成社群，用于检查联系、意向与人工进群回执。' }, nodes: [], area: 'contacts', contacts: [], contactsLoading: false, contactsError: '',
      join: { id: 900101, status: 'friendReported', statusText: '已报告发送好友申请，待管理员确认', note: '合成回执说明：请等待人工核实。', confirmedText: '' }, joinActions: { request: false, reportFriend: false, withdraw: true }, joinLoading: false, joinBusy: false, joinError: '', joinDone: '',
      canHandle: false, staffBatches: [], promotions: [], clubLoading: false, clubError: '',
    } },
    { name: 'honor-edit', page: 'team-honor-edit', state: '当前成员新建投稿，未选择或展示任何证据图', data: {
      loading: false, needsLogin: false, ready: true, editable: true, canSave: true, canSubmit: true, teams: [{ id: 900052, title: '合成代表队' }], teamIndex: 0, teamTitle: '合成游戏社群 · 合成代表队',
      fields: { title: '合成赛事成果与团队记录', competition: '本地合成赛事', placing: '示例成果（合成）', date: '2026-10-12', description: '合成文字用于检查长表单、说明文本和操作区。此页没有真实证据或个人资料。', removeVideo: false }, images: [], record: null,
    } },
    { name: 'honor-review', page: 'team-honor-workspace', state: '当前授权范围审核清单，证据区关闭且无证据图片', data: {
      loading: false, needsLogin: false, ready: true, view: 'review', actions: { create: false, review: true }, teams: [], docs: [entry], totalDocs: 1, page: 1, hasMore: false, detail: null,
    } },
    { name: 'honor-archive', page: 'team-honors', state: '公开档案，合成文本记录；无图片/视频', data: {
      loading: false, needsLogin: false, loaded: true, team: { id: 900052, title: '合成代表队荣誉档案', gameTitle: '合成游戏社群' }, records: [{ key: 'team-honor-records:900031', title: '合成赛事成果', competition: '本地合成赛事', placing: '示例成果（合成）', dateText: '2026-10-12', description: '这是一条合成的公开档案，用于检查年鉴式日期、结果和说明。', authorName: '合成投稿者', localImages: [], mediaLoading: false, mediaError: '', videoSource: '', videoError: '', legacy: false, sourceHref: '' }],
    } },
    { name: 'questionnaire', page: 'signup', state: '活动问卷第1页，使用实际questionnaire.presentation投影', data: {
      loading: false, needsLogin: false, error: '', edit: false, team: false, staff: false, applicationMode: false, receipt: null, info: { title: '合成活动报名', state: '报名开放', canManage: false, canViewSignups: false }, form, answers, ...questionnaire.presentation(form, answers, 0, 'rebuild-native-preview'), review: false,
    } },
    { name: 'account', page: 'account', state: '合成普通成员账号，不含邮箱/私人标识', data: { user, initial: '合', role: '社团成员', refreshing: false, error: '', reviewCommunity: false, reviewStaff: false } },
  ];
}

// Small WXML AST parser: keeps tags/attributes/ordering; handles raw operators inside bindings.
function parse(markup) {
  const root = { name: 'root', attrs: {}, children: [] }, stack = [root]; let offset = 0;
  const tags = /<!--[\s\S]*?-->|<\/?([\w-]+)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
  for (const match of markup.matchAll(tags)) {
    if (match.index > offset) stack.at(-1).children.push({ text: markup.slice(offset, match.index) });
    offset = match.index + match[0].length;
    if (!match[1]) continue;
    if (match[0].startsWith('</')) { const current = stack.pop(); if (current.name !== match[1]) throw new Error('Unbalanced WXML: ' + match[0]); continue; }
    const attrs = {};
    for (const attr of match[0].slice(match[1].length + 1).matchAll(/([\w:-]+)(?:="([^"]*)"|='([^']*)')?/g)) attrs[attr[1]] = attr[2] ?? attr[3] ?? true;
    const node = { name: match[1], attrs, children: [] }; stack.at(-1).children.push(node);
    if (!match[0].endsWith('/>')) stack.push(node);
  }
  if (offset < markup.length) root.children.push({ text: markup.slice(offset) });
  if (stack.length !== 1) throw new Error('Unclosed WXML tag');
  return root.children;
}
function evaluate(expression, data, object = false) {
  const body = expression.trim().replace(/^\{\{/, '').replace(/\}\}$/, '');
  try { return vm.runInNewContext(object ? '({' + body + '})' : '(' + body + ')', data, { timeout: 300 }); }
  catch { return undefined; } // Native templates resolve absent/null field paths as empty.
}
function binding(value, data) {
  if (typeof value !== 'string') return value;
  if (/^\{\{(?:(?!\}\})[\s\S])*\}\}$/.test(value)) return evaluate(value, data);
  return value.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expression) => String(evaluate(expression, data) ?? ''));
}
function textBinding(value, data) { return htmlEscape(value.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expression) => String(evaluate(expression, data) ?? ''))); }
function render(pageName, data) {
  const templates = new Map(), loaded = new Set();
  function include(file) {
    if (loaded.has(file)) return []; loaded.add(file);
    const nodes = parse(read(file));
    for (const node of nodes) {
      if (node.name === 'import') include(path.resolve(path.dirname(file), node.attrs.src));
      if (node.name === 'template' && node.attrs.name) templates.set(node.attrs.name, node.children);
    }
    return nodes;
  }
  const nodes = include(native('pages/' + pageName + '/index.wxml'));
  function children(nodes, scope) {
    let chain = false, matched = false, html = '';
    for (const node of nodes) {
      if ('text' in node) { html += textBinding(node.text, scope); continue; }
      const a = node.attrs;
      if ('wx:if' in a) { chain = true; matched = Boolean(binding(a['wx:if'], scope)); if (!matched) continue; }
      else if ('wx:elif' in a) { if (!chain || matched) continue; matched = Boolean(binding(a['wx:elif'], scope)); if (!matched) continue; }
      else if ('wx:else' in a) { if (!chain || matched) continue; matched = true; }
      else { chain = false; matched = false; }
      if (a['wx:for']) {
        const values = binding(a['wx:for'], scope) || [];
        for (const [index, item] of Object.entries(values)) html += element({ ...node, attrs: { ...a, 'wx:for': undefined } }, { ...scope, [a['wx:for-item'] || 'item']: item, [a['wx:for-index'] || 'index']: Number(index) });
      } else html += element(node, scope);
    }
    return html;
  }
  function element(node, scope) {
    const a = node.attrs, tag = node.name;
    if (['page-meta', 'import', 'privacy-consent'].includes(tag)) return '';
    if (tag === 'template') {
      if (!a.is) return '';
      const passed = a.data ? evaluate(a.data, scope, true) || {} : {};
      const body = templates.get(binding(a.is, scope)); if (!body) throw new Error('Missing template ' + a.is);
      return children(body, passed);
    }
    if (tag === 'block') return children(node.children, scope);
    const attrs = [];
    for (const [key, value] of Object.entries(a)) {
      if (key.startsWith('wx:') || key === 'is' || key === 'data' || value === undefined) continue;
      const resolved = binding(value, scope);
      if (key.startsWith('bind') || key.startsWith('catch')) { attrs.push('data-native-' + key + '="' + htmlEscape(resolved) + '"'); continue; }
      if (['disabled', 'checked', 'password', 'autoplay', 'controls', 'scroll-x', 'scroll-y', 'auto-height'].includes(key)) {
        if (resolved) attrs.push(key.startsWith('scroll-') || key === 'auto-height' ? 'data-native-' + key + '="true"' : key === 'password' ? 'type="password"' : key);
        continue;
      }
      if (key === 'placeholder-style') { attrs.push('data-native-placeholder-style="' + htmlEscape(resolved) + '"'); continue; }
      if (key === 'aria-role') { attrs.push('role="' + htmlEscape(resolved) + '"'); continue; }
      attrs.push(key + '="' + htmlEscape(typeof resolved === 'object' ? JSON.stringify(resolved) : resolved) + '"');
    }
    attrs.push('data-wxml-tag="' + tag + '"');
    if (tag === 'image') return '<img ' + attrs.join(' ') + ' alt="' + htmlEscape(binding(a['aria-label'] || '', scope)) + '">';
    if (tag === 'input') return '<input ' + attrs.join(' ') + ' readonly>';
    if (tag === 'textarea') return '<textarea ' + attrs.filter(item => !item.startsWith('value=')).join(' ') + ' readonly>' + htmlEscape(binding(a.value, scope)) + '</textarea>';
    if (tag === 'checkbox' || tag === 'radio' || tag === 'switch') return '<' + tag + ' ' + attrs.join(' ') + '><input type="' + (tag === 'radio' ? 'radio' : 'checkbox') + '" tabindex="-1" ' + (binding(a.checked, scope) ? 'checked ' : '') + (binding(a.disabled, scope) ? 'disabled ' : '') + 'style="accent-color:' + htmlEscape(binding(a.color, scope)) + '"></' + tag + '>';
    if (tag === 'progress') return '<progress ' + attrs.join(' ') + ' max="100" value="' + Number(binding(a.percent, scope) || 0) + '" style="--mapping-progress-active:' + htmlEscape(binding(a.activeColor, scope)) + ';--mapping-progress-background:' + htmlEscape(binding(a.backgroundColor, scope)) + ';height:' + Number(a['stroke-width'] || 4) + 'px"></progress>';
    if (tag === 'rich-text') return '<rich-text ' + attrs.join(' ') + '>' + (binding(a.nodes, scope) || []).map(n => htmlEscape(n.text || '')).join('') + '</rich-text>';
    return '<' + tag + ' ' + attrs.join(' ') + '>' + children(node.children, scope) + '</' + tag + '>';
  }
  return children(nodes, data);
}

const intrinsicMapping = `
html,body{margin:0;width:100%;min-width:0}body{background:var(--z-page);color:var(--z-text)}
page,view,scroll-view,picker,rich-text,checkbox-group,radio-group{display:block}page{min-height:100vh}
text{display:inline}button{display:block;font-family:inherit;cursor:default}input,textarea{font-family:inherit;box-sizing:border-box}textarea{resize:none}picker{min-width:0}
scroll-view[data-native-scroll-x]{overflow-x:auto;overflow-y:hidden}checkbox,radio,switch{display:inline-flex;flex-shrink:0;align-items:center}
checkbox input,radio input,switch input{width:22px!important;height:22px!important;min-height:22px!important;margin:0;padding:0;flex-shrink:0;border:initial}
progress{display:block;width:100%;border:0;appearance:none}progress::-webkit-progress-bar{background:var(--mapping-progress-background)}progress::-webkit-progress-value{background:var(--mapping-progress-active)}img{object-fit:cover}.mapping-label{box-sizing:border-box;display:block;width:100%;padding:9px 12px;font:12px/1.55 sans-serif;background:#30262e;color:#fffdf9;border-bottom:1px solid #a987a3;overflow-wrap:anywhere}.mapping-label strong{display:block}
`;
function sheet(css, width) { return css.replace(/(-?[\d.]+)rpx\b/g, (_match, number) => (Number(number) * width / 750) + 'px').replaceAll('env(safe-area-inset-bottom)', '20px'); }
const rows = [], fixtures = {}, manifests = [];
const browser = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox'] });
const browserVersion = browser.version();
try {
  for (const theme of ['light', 'dark']) {
    const rt = runtime(theme), shared = rt.load(native('lib/design-tokens.js'));
    for (const fixture of fixtureSet(rt)) {
      const data = { ...rt.page(fixture.page), ...fixture.data };
      if (data.themeUnavailable) throw new Error('Native theme failed to initialize');
      fixtures[fixture.name] ||= { page: fixture.page, state: fixture.state, data: fixture.data };
      for (const width of [390, 320]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: theme });
        const requests = [];
        await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
        const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
        const css = sheet(read(native('app.wxss')) + '\n' + read(native('pages/' + fixture.page + '/index.wxss')), width);
        const key = fixture.name + '-' + theme + '-' + width;
        const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + htmlEscape(label + ' · ' + fixture.name) + '</title><style>' + intrinsicMapping + '\n' + css + '</style></head><body style="' + htmlEscape(data.themePageStyle) + '"><aside class="mapping-label"><strong>' + label + '</strong>' + htmlEscape(fixture.state) + ' · ' + width + 'px · ' + theme + '</aside><page style="' + htmlEscape(data.themePageStyle) + '">' + render(fixture.page, data) + '</page></body></html>';
        fs.writeFileSync(path.join(output, key + '.html'), html);
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.evaluate(() => {
          const box = node => { const r = node.getBoundingClientRect(); return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; };
          const visible = node => { const r = node.getBoundingClientRect(), css = getComputedStyle(node); return r.width > 0 && r.height > 0 && css.visibility !== 'hidden' && css.display !== 'none'; };
          const nodes = [...document.querySelectorAll('page *')].filter(visible);
          const overflow = nodes.filter(node => { const r = node.getBoundingClientRect(); return !node.closest('scroll-view[data-native-scroll-x]') && (r.right > innerWidth + 1 || r.left < -1); }).map(node => ({ tag: node.tagName, className: node.className, text: node.textContent.trim().slice(0, 80), ...box(node) }));
          const controls = [...document.querySelectorAll('page button,page input:not([type="checkbox"]):not([type="radio"]),page textarea,page picker,page label.choice,page label.scale-choice')].filter(visible);
          const undersized = controls.filter(node => { const rect = node.getBoundingClientRect(); return rect.height < 43.5 || rect.width < 43.5; }).map(node => ({ tag: node.tagName, className: node.className, text: node.textContent.trim().slice(0, 80), ...box(node) }));
          const typographyRules = [
            { category: 'field', selector: 'page input:not([type="checkbox"]):not([type="radio"]),page textarea,page .field picker,page .picker-value', minimumPx: 14, applies: true },
            { category: 'body', selector: '.body,.subtitle,.hero-description,.notice-title,.card-summary,.muted,.choice,.field-label,.label,.answer-label,.consent,.privacy-note,.branch-notice,.error,.question-error,.reading-body', minimumPx: 14, applies: true },
            { category: 'mobile-action', selector: '.mini-page button,.mini-page picker', minimumPx: 15, applies: innerWidth < 360 },
            { category: 'mobile-steps', selector: '.timeline-step', minimumPx: 13, applies: innerWidth < 360 },
            { category: 'mobile-identifiers', selector: '.timeline-number,.record-id', minimumPx: 12, applies: innerWidth < 360 },
          ];
          const typography = typographyRules.map(rule => {
            const items = [...document.querySelectorAll(rule.selector)].filter(visible).map(node => ({ tag: node.tagName, className: node.className, text: node.textContent.trim().slice(0, 80), fontSize: parseFloat(getComputedStyle(node).fontSize), ...box(node) }));
            return { ...rule, matched: items.length, items, violations: rule.applies ? items.filter(item => item.fontSize < rule.minimumPx) : [] };
          });
          const smallFieldText = typography.find(rule => rule.category === 'field').violations;
          const smallBodyText = typography.find(rule => rule.category === 'body').violations;
          const smallActionText = typography.find(rule => rule.category === 'mobile-action').violations;
          const smallAuxiliaryText = typography.filter(rule => rule.category.startsWith('mobile-') && rule.category !== 'mobile-action').flatMap(rule => rule.violations);
          const clippedText = nodes.filter(node => ['BUTTON','TEXT','TEXTAREA'].includes(node.tagName) && node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).whiteSpace !== 'nowrap').map(node => ({ tag: node.tagName, className: node.className, text: node.textContent.trim().slice(0, 80), ...box(node), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
          return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, pageHeight: document.documentElement.scrollHeight, overflow, undersized, smallFieldText, smallBodyText, smallActionText, smallAuxiliaryText, typography, clippedText, pagePaddingBottom: getComputedStyle(document.querySelector('.mini-page')).paddingBottom, controls: controls.length };
        });
        await page.screenshot({ path: path.join(output, key + '.png'), fullPage: true, animations: 'disabled' });
        await page.screenshot({ path: path.join(output, key + '-viewport.png'), animations: 'disabled' });
        const row = { page: fixture.page, fixture: fixture.name, state: fixture.state, theme, width, screenshot: key + '.png', viewportScreenshot: key + '-viewport.png', html: key + '.html', ...metrics, blockedRequests: requests, errors, primary: shared.tokens[theme].primary };
        rows.push(row); console.log(JSON.stringify({ fixture: fixture.name, theme, width, overflow: metrics.overflow.length, undersized: metrics.undersized.length, smallText: metrics.smallFieldText.length + metrics.smallBodyText.length + metrics.smallActionText.length + metrics.smallAuxiliaryText.length, clippedText: metrics.clippedText.length, pageHeight: metrics.pageHeight }));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
for (const [file, source] of [...sourceFiles].sort(([a], [b]) => a.localeCompare(b))) {
  if (fs.readFileSync(file, 'utf8') !== source) throw new Error('Source changed before capture completed: ' + file);
  manifests.push({ path: path.relative(repository, file), sha256: crypto.createHash('sha256').update(source).digest('hex') });
}
fs.writeFileSync(path.join(output, 'fixtures.json'), JSON.stringify({ syntheticOnly: true, source: 'authored in scripts/rebuild-native-preview.mjs; actual JS initial state/pure projections; no API calls', fixtures }, null, 2));
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ label, recordedAt: new Date().toISOString(), playwright: playwrightVersion, browser: browserVersion, scope: 'Current WXML/WXSS/JS data layout mapping; no native lifecycle/events/SDK/official compilation/device validation', mapping: { rpx: 'viewport / 750', safeAreaBottom: '20px explicitly simulated', media: 'No QR, private evidence, real photos, or identifying user data', network: 'all browser requests blocked; native wx side effects throw', hostUI: 'Native navigation/tab bar/keyboard excluded; this is page content only', controls: 'Browser controls approximate static native appearance; checked/disabled/value/progress colors follow current WXML bindings', limits: 'No custom component rendering, image-mode measurement, native text measurement, input focus/keyboard, gesture, modal, media, auth or business event verification' }, sourceFiles: manifests, rows }, null, 2));
const cells = rows.map(row => '<article><h2>' + htmlEscape(row.fixture + ' · ' + row.theme + ' · ' + row.width + 'px') + '</h2><p>' + htmlEscape(row.state) + '</p><a href="' + row.screenshot + '"><img loading="lazy" src="' + row.viewportScreenshot + '" alt="' + htmlEscape(row.fixture) + '"></a><p><a href="' + row.html + '">原结构映射</a> · <a href="' + row.screenshot + '">全页截图</a></p></article>').join('');
fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + label + '</title><style>body{background:#f7f5f0;color:#202124;font:16px/1.7 sans-serif;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}article{border-top:1px solid #dfddd8;padding-top:20px}img{max-width:100%;width:320px;border:1px solid #dfddd8}h2{font-size:18px}a{color:#6f2d67}</style><h1>' + label + '</h1><p>当前原生源码的28个合成布局状态。图片不含真实二维码、证据或个人资料；未执行微信能力或生产请求。</p><main>' + cells + '</main></html>');
console.log('Saved ' + rows.length + ' mapped layout cases to ' + path.relative(repository, output));
if (rows.length !== 28 || rows.some(row => row.errors.length || row.blockedRequests.length || row.overflow.length || row.undersized.length || row.smallFieldText.length || row.smallBodyText.length || row.smallActionText.length || row.smallAuxiliaryText.length || row.clippedText.length)) process.exitCode = 1;
