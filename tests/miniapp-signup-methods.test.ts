import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { normalizeSignup, type Answers, type SignupForm } from '../src/lib/signup-schema';

type Kind = 'events' | 'community-posts' | 'staff';
type Receipt = { id: number; status: string; formVersion: string; questions: SignupForm['questions']; answers: Answers; createdAt: string; updatedAt: string };
type NativeRequest = { url: string; method: string; data: Record<string, unknown>; header: Record<string, string>; success(value: { statusCode: number; data: unknown }): void; fail(): void };
type Page = {
  data: { busy: boolean; message: string; answers: Answers; receipt: Receipt | null; responseEditing: boolean; review: boolean };
  setData(value: unknown): void; onLoad(options: { kind: Kind; id: string }): void; onShow(): Promise<void>;
  submit(): Promise<void>; editAnswers(): void; answerNext(): void;
  answer(event: { currentTarget: { dataset: { id: string } }; detail: { value: string } }): void;
};
const methods = ['OPTIONS', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'TRACE', 'CONNECT'];
const kinds: Kind[] = ['events', 'community-posts', 'staff'];
const form = normalizeSignup({ enabled: true, questions: [{ id: 'note', label: '合成答案', type: 'text', required: true }] });
const original: Receipt = { id: 811, status: 'returned', formVersion: 'synthetic-v1', questions: form.questions, answers: { note: '合成原稿' }, createdAt: '2026-10-12T01:00:00Z', updatedAt: '2026-10-12T02:00:00Z' };
const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };

async function harness(kind: Kind, saved: Receipt | null = original) {
  let page!: Page;
  const requests: NativeRequest[] = [], unsupported: NativeRequest[] = [];
  const user = { id: 901, name: '合成测试账号' };
  const session = { user: () => user, token: () => 'synthetic-token', clear: vi.fn(), subscribe: () => () => {} };
  const navigation = { login: vi.fn(), back: vi.fn(), go: vi.fn(), content: vi.fn(), website: vi.fn(), copy: vi.fn() };
  const wx = { setNavigationBarTitle: vi.fn(), pageScrollTo: vi.fn(), showToast: vi.fn(),
    request(options: NativeRequest) {
      requests.push(options);
      if (!methods.includes(options.method)) { unsupported.push(options); options.fail(); }
    },
  };
  const native = (filename: string, dependencies: Record<string, unknown>) => {
    const module = { exports: {} }, require = createRequire(new URL('../' + filename, import.meta.url));
    runInNewContext(readFileSync(filename, 'utf8'), { module, wx, require: (name: string) => dependencies[name] ?? require(name) });
    return module.exports;
  };
  const http = native('miniprogram/src/lib/http.js', { './session': session });
  const shared = native('miniprogram/src/lib/page.js', { './session': session, './navigation': navigation });
  const filename = 'miniprogram/src/pages/signup/index.js', require = createRequire(new URL('../' + filename, import.meta.url));
  const dependencies: Record<string, unknown> = { '../../lib/http': http, '../../lib/page': shared, '../../lib/session': session, '../../lib/navigation': navigation };
  runInNewContext(readFileSync(filename, 'utf8'), { Page: (value: Page) => { page = value; }, wx, require: (name: string) => dependencies[name] ?? require(name) });
  page.setData = value => Object.assign(page.data, value);
  page.onLoad({ kind, id: '55' });
  const info = (value: Receipt | null) => ({ title: '合成招新', state: kind === 'staff' ? '申请开放' : '报名开放', form, version: 'synthetic-v1',
    ...(kind === 'staff' ? { application: value, actions: { submit: true, edit: true } } : { signup: value }) });
  const loading = page.onShow();
  requests[0].success({ statusCode: 200, data: info(saved) });
  await loading;
  function edit() {
    if (saved) page.editAnswers();
    page.answer({ currentTarget: { dataset: { id: 'note' } }, detail: { value: '合成新稿' } });
    page.answerNext();
    expect(page.data.review).toBe(true);
  }
  async function confirm(sending: Promise<void>) {
    const updated = { ...(saved ?? original), status: 'submitted', updatedAt: '2026-10-12T03:00:00Z', answers: { note: '合成新稿' } };
    requests[1].success({ statusCode: 200, data: kind === 'staff' ? { application: updated } : { signup: updated } });
    await flush();
    if (kind === 'staff') requests[2].success({ statusCode: 200, data: info(updated) });
    await sending;
    expect(page.data.receipt).toMatchObject({ id: updated.id, updatedAt: updated.updatedAt, answers: updated.answers });
  }
  return { page, requests, unsupported, edit, confirm,
    endpoint: 'https://home.thuzijing.top' + (kind === 'staff' ? '/api/staff/batches/55/application' : '/api/activities/' + kind + '/55/signup') };
}

describe('活动/骨干修改报名：真实Page与HTTP，拒绝不支持method的合成wx SDK', () => {
  it.each(kinds)('%s 原稿编辑只发一次明确POST edit，延迟回调期间保留原编号和修订', async kind => {
    const h = await harness(kind);
    h.edit(); const sending = h.page.submit(); await h.page.submit();
    expect(h.requests).toHaveLength(2); expect(h.page.data.busy).toBe(true);
    expect(h.requests[1]).toMatchObject({ url: h.endpoint, method: 'POST', data: { action: 'edit', version: 'synthetic-v1', revision: original.updatedAt, answers: { note: '合成新稿' } }, header: { Authorization: 'JWT synthetic-token', 'x-questionnaire-version': '3' } });
    expect(h.requests[1].data).toEqual({ action: 'edit', version: 'synthetic-v1', revision: original.updatedAt, answers: { note: '合成新稿' } });
    expect(h.page.data.receipt).toMatchObject(original); expect(h.unsupported).toEqual([]);
    await h.confirm(sending);
    expect(h.requests.filter(value => value.method !== 'GET')).toHaveLength(1);
  });

  it.each(kinds)('%s 普通首次提交保留原POST正文，不增加edit或revision', async kind => {
    const h = await harness(kind, null);
    h.edit(); const sending = h.page.submit();
    expect(h.requests[1]).toMatchObject({ method: 'POST', url: h.endpoint });
    expect(h.requests[1].data).toEqual({ version: 'synthetic-v1', answers: { note: '合成新稿' } });
    await h.confirm(sending); expect(h.unsupported).toEqual([]);
  });

  it('骨干withdrawn重提仍为原POST与同一revision，不误标edit', async () => {
    const withdrawn = { ...original, status: 'withdrawn' };
    const h = await harness('staff', withdrawn);
    h.edit(); const sending = h.page.submit();
    expect(h.requests[1]).toMatchObject({ method: 'POST', url: h.endpoint });
    expect(h.requests[1].data).toEqual({ version: 'synthetic-v1', revision: withdrawn.updatedAt, answers: { note: '合成新稿' } });
    await h.confirm(sending); expect(h.unsupported).toEqual([]);
  });

  describe.each(['events', 'staff'] as const)('%s 写入拒绝', kind => {
    it.each(['network', 403, 409] as const)('%s失败不fallback、不自动重发或GET写，保留原回执与草稿', async outcome => {
      const h = await harness(kind);
      h.edit(); const sending = h.page.submit(); await h.page.submit();
      expect(h.requests[1]).toMatchObject({ method: 'POST', data: { action: 'edit', revision: original.updatedAt } });
      if (outcome === 'network') h.requests[1].fail();
      else h.requests[1].success({ statusCode: outcome, data: { error: '合成写入拒绝' } });
      await sending; await flush();
      expect(h.requests).toHaveLength(2); expect(h.unsupported).toEqual([]);
      expect(h.page.data).toMatchObject({ busy: false, answers: { note: '合成新稿' }, responseEditing: true, review: true });
      expect(h.page.data.receipt).toMatchObject(original);
      expect(h.page.data.message).toBeTruthy();
    });
  });
});
