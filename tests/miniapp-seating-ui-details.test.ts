import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { chromium, type Browser, type Page as BrowserPage } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type NativeSeat = { id: string; number: number; style: string; label: string; picked: boolean; locked: boolean };
type NativeRow = { row: number; accent: boolean; indent: number; seats: NativeSeat[] };
type NativePage = { data: Record<string, unknown>; setData(data: Record<string, unknown>): void; [key: string]: unknown };
type Mode = 'light' | 'dark' | 'summer' | 'simple';
type Theme = { style(mode: Mode): string; tokens: Record<Mode, { stage: string; stage2: string; stageMuted: string }> };

const read = (path: string) => readFileSync(path, 'utf8');
const markup = read('miniprogram/src/pages/activity-seating/index.wxml');
const globalStyles = read('miniprogram/src/app.wxss').replace(/@import[^;]+;/, '');
const componentStyles = read('miniprogram/src/templates/v2.wxss');
const seatStyles = read('miniprogram/src/pages/activity-seating/index.wxss');
const invoke = (page: NativePage, method: string, ...args: unknown[]) =>
  (page[method] as (...values: unknown[]) => unknown).apply(page, args);
const tap = (seat: string) => ({ currentTarget: { dataset: { seat } } });

function themeModule(): Theme {
  const generated = { exports: {} };
  runInNewContext(read('miniprogram/src/lib/design-tokens.js'), { module: generated });
  const module = { exports: {} as Theme };
  runInNewContext(read('miniprogram/src/lib/theme.js'), { module, require: () => generated.exports });
  return module.exports;
}

function nativePage() {
  const modules: Record<string, unknown> = {
    '../../lib/theme': { page: (definition: NativePage) => definition }, '../../lib/http': {},
    '../../lib/files': {}, '../../lib/navigation': {}, '../../lib/privacy': {}, '../../lib/session': {},
    '../../lib/format': { date: () => '' }, '../../lib/page': { actions: {} },
  };
  let page!: NativePage;
  runInNewContext(read('miniprogram/src/pages/activity-seating/index.js'), {
    Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name], setTimeout, clearTimeout,
  });
  page.setData = values => {
    for (const [key, value] of Object.entries(values)) {
      const path = /^rows\[(\d+)\]\.(?:seats\[(\d+)\]|(indent))$/.exec(key);
      if (!path) { page.data[key] = value; continue; }
      const row = (page.data.rows as NativeRow[])[Number(path[1])];
      if (path[2] !== undefined) row.seats[Number(path[2])] = value as NativeSeat;
      else row.indent = value as number;
    }
  };
  Object.assign(page, { _hidden: true, _closed: false });
  page.data.loading = false;
  invoke(page, 'showState', {
    title: '合成活动', enabled: true, open: true, loggedIn: true, canReview: false, mode: 'selection',
    rows: [{ row: 1, count: 8, offset: 0 }, { row: 2, count: 7, offset: 2, accent: true }],
    occupancy: { '1-3': 'pending', '1-4': 'confirmed', '1-5': 'confirmed' }, blockedSeats: ['1-5'],
    seatLimit: 10, proofLimit: 10, proofBytes: 8388608, drafts: [], mine: null,
  });
  invoke(page, 'toggle', tap('1-1'));
  return page;
}

function cssAtWidth(css: string, width: number) {
  return css.replace(/(-?\d*\.?\d+)rpx\b/g, (_, n: string) => `${Number(n) * width / 750}px`);
}

function syntheticHtml(page: NativePage, theme: Theme, mode: Mode, width: number) {
  const rows = page.data.rows as NativeRow[];
  const legend = [
    ['available', '可选'], ['selected', '已选'], ['pending', '待审核'], ['confirmed', '已确认'],
    ['blocked', '未开放'], ['available accent', '中心区'],
  ].map(([style, text]) => `<div class="seat-key"><div class="seat-swatch ${style}"></div><span>${text}</span></div>`).join('');
  const numbers = rows.map(row => `<span class="seat-row-number ${row.accent ? 'accent' : ''}">${row.row}</span>`).join('');
  const cells = rows.map(row => `<div class="seat-row ${row.accent ? 'accent' : ''}" style="padding-left:${row.indent}px">${row.seats.map(seat =>
    `<button class="seat ${seat.style} ${seat.picked ? 'chosen' : ''}" data-seat="${seat.id}" aria-label="${seat.label}" aria-disabled="${seat.locked}" aria-selected="${seat.picked}">${seat.number}</button>`).join('')}</div>`).join('');
  const styles = cssAtWidth(`${componentStyles}\n${globalStyles}\n${seatStyles}`, width);
  return `<style>body{margin:0}div,span,button{box-sizing:border-box}.seat-scroll{overflow-x:auto;overflow-y:hidden}${styles}</style>
    <div class="page mini-page seat-page ${mode === 'simple' ? 'seat-page-simple' : ''} ${mode === 'dark' || mode === 'summer' ? 'zj-dark' : ''}" style="${theme.style(mode)}">
      <div class="seat-arena"><div class="seat-arena-tools"><div class="seat-legend">${legend}</div>
        <div class="seat-zoom"><button class="seat-zoom-step" ${page.data.zoom === 0 ? 'disabled' : ''}>−</button><span class="seat-zoom-label">${page.data.zoomLabel}</span><button class="seat-zoom-step" ${page.data.zoom === 2 ? 'disabled' : ''}>＋</button></div></div>
        <div class="seat-board zoom-${page.data.zoom}"><div class="seat-row-numbers"><div class="seat-stage-spacer"></div>${numbers}</div>
          <div class="seat-scroll"><div class="seat-grid" style="width:${page.data.boardWidth}px"><div class="seat-stage"><div class="seat-stage-arc"></div><span class="seat-stage-label">舞台 · 屏幕</span></div>${cells}</div></div>
        </div></div></div>`;
}

function rgb(value: string): number[] {
  const match = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`Unexpected color: ${value}`);
  return match.slice(1, 4).map(Number);
}
function hex(value: string): number[] { return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16)); }
function contrast(a: number[], b: number[]) {
  const luminance = (color: number[]) => color.map(channel => channel / 255).map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

let browser: Browser;
let view: BrowserPage;

describe('小程序座位图细节', () => {
  it('保留实际页面的原生按钮、无障碍状态和横向滚动绑定', () => {
    expect(markup).toMatch(/<scroll-view\s+scroll-x\b/);
    expect(markup).toMatch(/<block wx:for="\{\{row\.seats\}\}"[^>]*>\s*<view wx:if="\{\{seat\.missing\}\}"[^>]*><\/view>\s*<button wx:else[^>]*bindtap="toggle"[^>]*aria-label="\{\{seat\.label\}\}"[^>]*aria-disabled=[^>]*aria-selected=/s);
    expect(markup).toContain('width: {{boardWidth}}px');
    expect(markup).toContain('padding-left: {{row.indent}}px');
  });

});

// A fresh dependency install may not include Playwright's browser; report those checks as skipped.
describe.skipIf(!existsSync(chromium.executablePath()))('小程序座位图浏览器布局模拟', () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); view = await browser.newPage(); });
  afterAll(async () => { await browser?.close(); });

  it('四种主题的座位、图例及文字保持一致和可读', async () => {
    const theme = themeModule();
    const pairs = [
      ['.seat[data-seat="1-2"]', '.seat-swatch.available:not(.accent)'],
      ['.seat[data-seat="1-1"]', '.seat-swatch.selected'],
      ['.seat[data-seat="1-3"]', '.seat-swatch.pending'],
      ['.seat[data-seat="1-4"]', '.seat-swatch.confirmed'],
      ['.seat[data-seat="1-5"]', '.seat-swatch.blocked'],
      ['.seat[data-seat="2-1"]', '.seat-swatch.available.accent'],
    ];
    for (const mode of ['light', 'dark', 'summer', 'simple'] as Mode[]) {
      await view.setViewportSize({ width: 375, height: 900 });
      await view.setContent(syntheticHtml(nativePage(), theme, mode, 375));
      const results = await view.evaluate((selectors) => selectors.map(pair => pair.map(selector => {
        const node = document.querySelector(selector);
        if (!node) throw new Error(`Missing ${selector}`);
        const css = getComputedStyle(node);
        return { color: css.color, border: css.borderTopColor, background: css.backgroundColor, image: css.backgroundImage };
      })), pairs);
      const palette = theme.tokens[mode];
      const stageColors = [hex(palette.stage), hex(palette.stage2)];
      if (mode !== 'simple') stageColors.push(hex(palette.stage2).map((c, i) => c * 0.66 + [155, 63, 176][i] * 0.34));
      for (const [seat, swatch] of results) {
        expect(seat, `${mode}: legend matches seat`).toEqual(swatch);
        const backgrounds = [...seat.image.matchAll(/rgba?\([^)]*\)/g)].map(match => match[0])
          .filter(color => !/^rgba\([^)]*,\s*0\)$/.test(color));
        if (!seat.background.endsWith(', 0)')) backgrounds.push(seat.background);
        expect(backgrounds.length, `${mode}: seat background`).toBeGreaterThan(0);
        for (const color of backgrounds) expect(contrast(rgb(seat.color), rgb(color)), `${mode}: ${seat.color} on ${color}`).toBeGreaterThanOrEqual(4.5);
        for (const color of stageColors) expect(contrast(rgb(seat.border), color), `${mode}: border ${seat.border}`).toBeGreaterThanOrEqual(3);
      }
      for (const color of stageColors) expect(contrast(hex(palette.stageMuted), color), `${mode}: legend text`).toBeGreaterThanOrEqual(4.5);
      const labels = await view.evaluate(() => ['.seat-row-number.accent', '.seat-stage-label'].map(selector => {
        const css = getComputedStyle(document.querySelector(selector)!);
        return { color: css.color, background: css.backgroundColor };
      }));
      expect(labels[0].background, `${mode}: center row number background`).toBe('rgba(0, 0, 0, 0)');
      for (const label of labels) for (const color of stageColors)
        expect(contrast(rgb(label.color), color), `${mode}: stage label`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('三个缩放档在窄屏及常用屏宽上保留独立的点击区域和滚动访问', async () => {
    const theme = themeModule();
    for (const width of [320, 375, 414]) for (const zoom of [0, 1, 2]) {
      const native = nativePage();
      if (zoom !== 1) invoke(native, 'rescale', { currentTarget: { dataset: { delta: zoom - 1 } } });
      const size = [44, 52, 60][zoom], step = size + 6;
      expect(native.data).toMatchObject({ zoom, boardWidth: 9 * step + 24 });
      expect((native.data.rows as NativeRow[])[1].indent).toBe(2 * step);
      await view.setViewportSize({ width, height: 900 });
      await view.setContent(syntheticHtml(native, theme, 'simple', width));
      const geometry = await view.evaluate(() => {
        const box = (selector: string) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        };
        const scroll = document.querySelector('.seat-scroll')!;
        return { first: box('[data-seat="1-1"]'), second: box('[data-seat="1-2"]'), nextRow: box('[data-seat="2-1"]'), zoomButton: box('.seat-zoom-step'),
          scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth };
      });
      for (const cell of [geometry.first, geometry.second, geometry.nextRow]) {
        expect(cell.width, `${width}px / zoom ${zoom}`).toBe(size);
        expect(cell.height, `${width}px / zoom ${zoom}`).toBe(size);
        expect(cell.width).toBeGreaterThanOrEqual(44);
      }
      expect(geometry.second.x - geometry.first.right).toBe(6);
      expect(geometry.nextRow.y - geometry.first.bottom).toBe(6);
      expect(geometry.zoomButton.width).toBe(44);
      expect(geometry.zoomButton.height).toBe(44);
      expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);

      await view.evaluate(() => {
        (window as unknown as { hits: string[] }).hits = [];
        document.querySelectorAll<HTMLButtonElement>('button.seat').forEach(button => button.addEventListener('click', () => {
          (window as unknown as { hits: string[] }).hits.push(button.dataset.seat!);
        }));
      });
      await view.mouse.click(geometry.first.right - 1, geometry.first.y + size / 2);
      await view.mouse.click(geometry.first.right + 3, geometry.first.y + size / 2);
      await view.mouse.click(geometry.second.x + 1, geometry.second.y + size / 2);
      await view.mouse.click(geometry.first.x + size / 2, geometry.first.bottom + 3);
      await view.locator('.seat-scroll').evaluate(element => { element.scrollLeft = element.scrollWidth; });
      await view.locator('[data-seat="1-8"]').click();
      await view.locator('[data-seat="1-1"]').focus();
      await view.keyboard.press('Space');
      await view.keyboard.press('Enter');
      const hits = await view.evaluate(() => (window as unknown as { hits: string[] }).hits);
      expect(hits, `${width}px / zoom ${zoom}: gaps and keyboard`).toEqual(['1-1', '1-2', '1-8', '1-1', '1-1']);
      for (const seat of hits) invoke(native, 'toggle', tap(seat));
      expect(Array.from(native.data.selected as string[])).toEqual(['1-2', '1-8']);
      for (const seat of ['1-3', '1-4', '1-5']) invoke(native, 'toggle', tap(seat));
      expect(Array.from(native.data.selected as string[])).toEqual(['1-2', '1-8']);
      expect((native.data.rows as NativeRow[])[0].seats[1]).toMatchObject({ style: 'selected', label: '1排2座 · 已选' });
    }
  }, 30000);
});
