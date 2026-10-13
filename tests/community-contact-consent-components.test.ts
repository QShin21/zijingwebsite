import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { isValidElement, type ReactElement } from 'react';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { applicationContactConsentLabel as label, applicationContactConsentRequiredMessage as message } from '../src/lib/community-status';

type Values = Record<string, unknown>;
type Element = ReactElement<Values>;
type Initial = { id: number; updatedAt: string; proposedGame: string; reason: string; contactConsent?: boolean | null };
type Event = { preventDefault(): void; currentTarget: { reportValidity(): boolean; reset(): void } };
const require = createRequire(import.meta.url);
const sourceForm = readFileSync('src/components/CommunityApplicationForm.tsx', 'utf8');
const sourceReview = readFileSync('src/app/(frontend)/community/review/page.tsx', 'utf8');
const shared = { applicationContactConsentLabel: label, applicationContactConsentRequiredMessage: message };
const initial = (consent?: boolean | null): Initial => ({ id: 81, updatedAt: '2026-10-13T01:00:00Z', proposedGame: '合成游戏', reason: '合成已填写申请说明', contactConsent: consent });
function evaluate(text: string, dependencies: Values, extra: Values = {}) {
  const exports: Values = {};
  const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  runInNewContext(output, { exports, require: (name: string) => dependencies[name] ?? require(name), ...extra });
  return exports;
}
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  return isValidElement<Values>(value) ? [value, ...elements(value.props.children)] : [];
}
function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(text).join('');
  return isValidElement<Values>(value) ? text(value.props.children) : '';
}
const formData = new FormData();
const file = new File(['synthetic-file-only'], 'synthetic-card.png', { type: 'image/png' });
formData.set('realName', '合成申请人'); formData.set('phone', '13900000000'); formData.set('reason', '合成保留原填写内容和文件的申请说明'); formData.set('wechatQr', file);

// Execute the actual TSX handlers with a hook/DOM boundary fixture, not a browser.
// The E2E spec separately verifies real focus, validation and retained FileList.
function formHarness(saved?: Initial) {
  const slots: unknown[] = [], effects: (() => void)[] = [];
  let cursor = 0, tree: unknown;
  const action = vi.fn<(data: FormData) => Promise<{ error?: string; field?: string }>>().mockResolvedValue({ error: '合成服务拒绝' });
  const router = { push: vi.fn(), refresh: vi.fn() };
  const input = { checked: false, focus: vi.fn(), scrollIntoView: vi.fn() };
  const reportValidity = vi.fn(() => true), construct = vi.fn(), reset = vi.fn();
  const values = new FormData(); for (const [key, value] of formData) values.set(key, value);
  values.set('id', String(saved?.id ?? '')); values.set('revision', saved?.updatedAt ?? '');
  const hooks = {
    useSyncExternalStore: () => true,
    useId() { const index = cursor++; slots[index] ??= 'synthetic-consent-' + index; return slots[index]; },
    useRef(value: unknown) { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; },
    useState(value: unknown) {
      const index = cursor++; if (slots[index] === undefined) slots[index] = value;
      return [slots[index], (next: unknown) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useEffect(callback: () => void, dependencies: unknown[]) {
      const index = cursor++, previous = slots[index] as unknown[] | undefined;
      if (!previous || dependencies.some((value, i) => value !== previous[i])) effects.push(callback);
      slots[index] = dependencies;
    },
  };
  class BrowserFormDataFixture {
    constructor() { construct(); const value = new FormData(); for (const [key, entry] of values) value.set(key, entry); if (input.checked) value.set('contactConsent', 'on'); return value; }
  }
  const component = evaluate(sourceForm, { react: hooks, 'next/navigation': { useRouter: () => router },
    '@/lib/community-status': shared, '@/app/(frontend)/community/actions': { applyAction: action } }, { FormData: BrowserFormDataFixture }).CommunityApplicationForm as (props: unknown) => unknown;
  function find(predicate: (value: Element) => boolean) { const value = elements(tree).find(predicate); expect(value).toBeDefined(); return value!; }
  function render() {
    cursor = 0; tree = component({ games: [{ id: 31, title: '合成已有游戏' }], initial: saved });
    const checkbox = find(value => value.type === 'input' && value.props.name === 'contactConsent');
    const ref = checkbox.props.ref as { current: typeof input | null } | undefined;
    if (ref && !ref.current) { input.checked = Boolean(checkbox.props.defaultChecked); ref.current = input; }
    effects.splice(0).forEach(callback => callback());
    return tree;
  }
  render();
  return { action, router, input, values, reportValidity, construct, reset, render, find,
    getTree: () => tree,
    submit() { return (find(value => value.type === 'form').props.onSubmit as (event: Event) => Promise<void>)({ preventDefault: vi.fn(), currentTarget: { reportValidity, reset } }); },
    check(value: boolean) { input.checked = value; (find(node => node.props.name === 'contactConsent').props.onChange as (event: unknown) => void)?.({ currentTarget: input }); render(); },
  };
}

describe('管理员申请网页：实际TSX handler、合成DOM/action边界', () => {
  it.each([
    ['new', undefined, false], ['returned false', initial(false), false], ['missing', initial(), false],
    ['null', initial(null), false], ['本人已授权', initial(true), true], ['untrusted string', initial('true' as unknown as boolean), false],
  ] as const)('%s准确回显且不代勾选', (_name, saved, checked) => {
    const h = formHarness(saved); const checkbox = h.find(value => value.props.name === 'contactConsent');
    expect(checkbox.props.defaultChecked).toBe(checked); expect(h.input.checked).toBe(checked);
    expect(checkbox.props.required).not.toBe(true); expect(checkbox.props['aria-required']).toBe('true');
    expect(text(h.find(value => value.type === 'label' && value.props.htmlFor === checkbox.props.id))).toBe(label);
    expect(h.find(value => value.type === 'form').props.noValidate).toBe(true);
    expect(h.action).not.toHaveBeenCalled();
  });

  it('未同意时指定中文优先于其它required检查，可访问提示和焦点，不丢资料或文件', async () => {
    const h = formHarness(); h.reportValidity.mockReturnValue(false);
    await h.submit(); h.render();
    const alert = h.find(value => value.props.role === 'alert'), checkbox = h.find(value => value.props.name === 'contactConsent');
    expect(text(alert)).toBe(message); expect(checkbox.props['aria-invalid']).toBe(true);
    expect(checkbox.props['aria-describedby']).toContain(alert.props.id);
    expect(h.input.focus).toHaveBeenCalled(); expect(h.input.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(h.reportValidity).not.toHaveBeenCalled(); expect(h.construct).not.toHaveBeenCalled(); expect(h.action).not.toHaveBeenCalled();
    expect(h.values.get('realName')).toBe('合成申请人'); expect(h.values.get('wechatQr')).toBe(file); expect(h.reset).not.toHaveBeenCalled();
  });

  it('勾选后取消指定提示，保留其它必填校验，不把checked代替资料有效', async () => {
    const h = formHarness(); await h.submit(); h.render(); h.check(true); h.reportValidity.mockReturnValue(false);
    await h.submit(); h.render();
    expect(elements(h.getTree()).some(value => value.props.role === 'alert')).toBe(false);
    expect(h.reportValidity).toHaveBeenCalledOnce(); expect(h.action).not.toHaveBeenCalled(); expect(h.values.get('wechatQr')).toBe(file);
  });

  it('已存true被本人取消后也阻断重新提交，不恢复为true', async () => {
    const h = formHarness(initial(true)); h.check(false); await h.submit(); h.render();
    expect(h.input.checked).toBe(false); expect(text(h.find(value => value.props.role === 'alert'))).toBe(message); expect(h.action).not.toHaveBeenCalled();
  });

  it.each(['returned false', 'missing'] as const)('%s由本人勾选后，发送原id/revision和原文件，成功才导航', async kind => {
    const h = formHarness(kind === 'missing' ? initial() : initial(false)); h.check(true); h.action.mockResolvedValueOnce({});
    await h.submit(); h.render();
    const body = h.action.mock.calls[0][0]; expect(body.get('id')).toBe('81'); expect(body.get('revision')).toBe(initial().updatedAt);
    expect(body.get('contactConsent')).toBe('on'); expect(body.get('wechatQr')).toBe(file);
    expect(h.router.push).toHaveBeenCalledWith('/community/apply?submitted=1'); expect(h.router.refresh).toHaveBeenCalledOnce();
  });

  it('同周期重复提交只一份在途action；失败保留已填资料和文件，不自动重发', async () => {
    const h = formHarness(initial(true)); let reject!: (cause: Error) => void;
    h.action.mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no; }));
    const sending = h.submit(); await h.submit(); h.render();
    expect(h.action).toHaveBeenCalledOnce(); expect(h.find(value => value.type === 'fieldset').props.disabled).toBe(true);
    reject(new Error('合成网络失败')); await sending; h.render();
    expect(text(h.find(value => value.props.role === 'status'))).toContain('填写的资料已保留');
    expect(h.action).toHaveBeenCalledOnce(); expect(h.input.checked).toBe(true); expect(h.values.get('wechatQr')).toBe(file);
    expect(h.values.get('reason')).toBe(formData.get('reason')); expect(h.reset).not.toHaveBeenCalled(); expect(h.router.push).not.toHaveBeenCalled();
  });

  it('服务器field contactConsent拒绝后释放锁并定位指定提示，不丢原填写或代同意', async () => {
    const h = formHarness(initial(true)); h.action.mockResolvedValueOnce({ error: message, field: 'contactConsent' });
    await h.submit(); h.render();
    expect(text(h.find(value => value.props.role === 'alert'))).toBe(message); expect(h.input.focus).toHaveBeenCalled();
    expect(h.find(value => value.type === 'fieldset').props.disabled).toBe(false); expect(h.values.get('wechatQr')).toBe(file);
    expect(h.action).toHaveBeenCalledOnce(); expect(h.router.push).not.toHaveBeenCalled(); expect(h.reset).not.toHaveBeenCalled();
  });
});

async function reviewHarness(contactConsent: unknown, complete = true, authorized = true) {
  const user = { id: 901, name: '合成审核者', accountStatus: 'active', roles: authorized ? ['president'] : ['member'] };
  const app = { id: 81, applicant: 501, status: 'pending', realName: complete ? '合成申请人' : null, phone: '13900000000', wechatQr: 'synthetic-only', proposedGame: '合成旧申请', reason: '合成未审核申请说明', createdAt: '2026-10-13T01:00:00Z', updatedAt: '2026-10-13T02:00:00Z', contactConsent };
  const find = vi.fn(async (options: Values) => options.collection === 'community-applications'
    ? { docs: [app], totalPages: 1 } : { docs: [{ id: 501, name: '合成申请账号', email: 'synthetic@example.invalid', accountStatus: 'active' }] });
  const rules = evaluate(readFileSync('src/lib/rules.ts', 'utf8'), {}, { URL });
  const component = evaluate(sourceReview, {
    'next/image': { __esModule: true, default: 'img' }, 'next/headers': { headers: async () => new Headers() },
    'next/navigation': { notFound: () => { throw new Error('synthetic-notFound'); } },
    '@/components/SubmitButton': { SubmitButton: 'button' }, '@/components/PageHeading': { PageHeading: 'header' }, '@/components/Content': { Pagination: 'nav' },
    '@/lib/content': { cms: async () => ({ auth: async () => ({ user }), find }) }, '@/lib/rules': rules, '@/lib/community-status': shared,
    '../actions': { decideAction: vi.fn() },
    '../../_club/ClubPage': { ClubFrame: 'div' },
  }).default as (value: unknown) => Promise<unknown>;
  const tree = await component({ searchParams: Promise.resolve({}) });
  return { tree, find, user };
}

describe('审核网页实际Server Component函数：合成CMS，历史未同意不得批准', () => {
  it.each([false, null, undefined, 'true'])('旧值%s只显示真实未授权并引导退回，由本人补勾选', async consent => {
    const h = await reviewHarness(consent), nodes = elements(h.tree);
    expect(nodes.find(value => value.props.value === 'approved')?.props.disabled).toBe(true);
    expect(nodes.find(value => value.props.value === 'returned')?.props.disabled).not.toBe(true);
    expect(nodes.find(value => value.props.value === 'rejected')?.props.disabled).not.toBe(true);
    expect(text(h.tree)).toContain(message); expect(text(h.tree)).toContain('请退回申请，由本人勾选'); expect(text(h.tree)).toContain(label);
    expect(text(h.tree)).not.toContain('批准后不提供公开名片');
    expect(h.find.mock.calls[0][0]).toMatchObject({ overrideAccess: false, user: h.user, where: { status: { equals: 'pending' } } });
  });
  it('本人true且资料齐全可显示批准，未替用户改授权值或权限', async () => {
    const h = await reviewHarness(true); expect(elements(h.tree).find(value => value.props.value === 'approved')?.props.disabled).toBe(false);
    expect(text(h.tree)).toContain('申请人已同意展示微信名片作为进群联系方式'); expect(text(h.tree)).not.toContain('不能批准');
  });
  it('true也不绕过资料完整性检查', async () => {
    const h = await reviewHarness(true, false); expect(elements(h.tree).find(value => value.props.value === 'approved')?.props.disabled).toBe(true);
    expect(text(h.tree)).toContain('此申请资料不全');
  });
  it('无审核权限仍不可访问，前端提示不扩大权限', async () => { await expect(reviewHarness(true, true, false)).rejects.toThrow('synthetic-notFound'); });
});
