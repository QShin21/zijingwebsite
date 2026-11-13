import { i18nStub } from "./i18n-stubs";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Values = Record<string, unknown>;
type Element = ReactElement<Values>;
const require = createRequire(import.meta.url);
const source = readFileSync("src/components/TeamCoreControls.tsx", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Values>(value)) return [];
  const rendered =
    typeof value.type === "function"
      ? (value.type as (props: Values) => unknown)(value.props)
      : value.props.children;
  return [value, ...elements(rendered)];
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  if (!isValidElement<Values>(value)) return "";
  return text(
    typeof value.type === "function"
      ? (value.type as (props: Values) => unknown)(value.props)
      : value.props.children,
  );
}
const response = (ok: boolean, body: unknown, status = ok ? 200 : 409) => ({
  ok,
  status,
  json: async () => body,
});
const form = { questions: [] };
function harness(
  name = "TeamCoreEstablishmentForm",
  props: Values = { games: [{ id: 24, title: "合成社群" }] },
) {
  const slots: unknown[] = [];
  let cursor = 0,
    tree: unknown;
  const request = vi
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue(response(false, { error: "合成业务拒绝" }));
  const router = { push: vi.fn(), refresh: vi.fn() },
    focus = vi.fn();
  const values = new FormData();
  values.set("gameID", "24");
  values.set("title", "合成代表队");
  values.set("reason", "合成已填写的组织训练计划");
  values.set("note", "合成审核意见");
  const hooks = {
    useSyncExternalStore: () => true,
    useRef(value: unknown) {
      const index = cursor++;
      slots[index] ??= { current: value };
      return slots[index];
    },
    useState(value: unknown) {
      const index = cursor++;
      if (slots[index] === undefined) slots[index] = value;
      return [
        slots[index],
        (next: unknown) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
  };
  class BrowserFormDataFixture {
    constructor() {
      const data = new FormData();
      for (const [key, value] of values) data.set(key, value);
      return data;
    }
  }
  const dependencies: Values = {
    react: hooks,
    "next/navigation": { useRouter: () => router },
    "next/link": { __esModule: true, default: "a" },
    "./team-pages/TeamPages.module.css": {},
    "./Questionnaire": { Questionnaire: "questionnaire" },
    "./SignupBuilder": { SignupBuilder: "signup-builder" },
    "@/lib/signup-schema": { normalizeSignup: (value: unknown) => value },
    "@/lib/questionnaire-model": {
      sanitizeDraft: (_form: unknown, answers: unknown) => answers,
      formatAnswer: String,
    },
  };
  const exports: Values = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => dependencies[name] ?? i18nStub(name) ?? require(name),
    fetch: request,
    FormData: BrowserFormDataFixture,
    Error,
  });
  const component = exports[name] as (props: Values) => unknown;
  function find(predicate: (node: Element) => boolean) {
    const result = elements(tree).find(predicate);
    expect(result).toBeDefined();
    return result!;
  }
  function render() {
    cursor = 0;
    tree = component(props);
    for (const node of elements(tree)) {
      const ref = node.props.ref as { current: unknown } | undefined;
      if (ref && !ref.current)
        ref.current = { focus, reportValidity: () => true };
    }
  }
  async function submit(decision?: string) {
    await (
      find((node) => node.type === "form").props.onSubmit as (
        event: unknown,
      ) => Promise<void>
    )({
      preventDefault: vi.fn(),
      currentTarget: {},
      nativeEvent: { submitter: { value: decision } },
    });
    render();
  }
  function confirm() {
    (
      find((node) => node.props.type === "checkbox").props.onChange as (
        event: unknown,
      ) => void
    )({ currentTarget: { checked: true } });
    render();
  }
  render();
  return {
    request,
    router,
    focus,
    values,
    render,
    find,
    submit,
    confirm,
    getTree: () => tree,
  };
}

describe("队伍工作台异步反馈：实际 TSX，合成 fetch / hook 边界", () => {
  it.each([
    ["TeamCoreEstablishmentForm", { games: [{ id: 24, title: "合成社群" }] }],
    [
      "TeamCoreDecision",
      { kind: "join", id: 71, revision: "synthetic-revision" },
    ],
    [
      "TeamCoreOperation",
      {
        operation: "leave",
        id: 7,
        revision: "synthetic-revision",
        label: "办理本人离队",
      },
    ],
  ] as const)(
    "%s静态SSR渲染明确POST，水合前禁止提交私人表单",
    (name, props) => {
      const exports: Values = {};
      const dependencies: Values = {
        "next/navigation": {
          useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
        },
        "next/link": { __esModule: true, default: "a" },
        "./team-pages/TeamPages.module.css": {},
        "./Questionnaire": { Questionnaire: "questionnaire" },
        "./SignupBuilder": { SignupBuilder: "signup-builder" },
        "@/lib/signup-schema": {},
        "@/lib/questionnaire-model": {},
      };
      runInNewContext(compiled, {
        exports,
        require: (name: string) => dependencies[name] ?? i18nStub(name) ?? require(name),
      });
      const component = exports[name] as (props: Values) => ReactElement;
      const html = renderToStaticMarkup(createElement(component, props));
      expect(html).toContain('method="post"');
      const buttons = html.match(/<button\b[^>]*>/g) || [];
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((button) => button.includes('disabled=""'))).toBe(
        true,
      );
    },
  );
  it("同周期重复提交仅发送一次；业务拒绝保留内容，不刷新或自动重发", async () => {
    const h = harness();
    let finish!: (value: unknown) => void;
    h.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const sending = h.submit();
    await h.submit();
    expect(h.request).toHaveBeenCalledOnce();
    h.render();
    expect(h.find((node) => node.type === "form").props["aria-busy"]).toBe(
      true,
    );
    finish(response(false, { error: "合成版本冲突，请核对" }));
    await sending;
    expect(text(h.getTree())).toContain("合成版本冲突，请核对");
    expect(h.values.get("reason")).toBe("合成已填写的组织训练计划");
    expect(h.router.refresh).not.toHaveBeenCalled();
    expect(h.find((node) => node.type === "button").props.disabled).toBe(false);
  });
  it.each([
    ["网络中断", () => Promise.reject(new Error("synthetic connection loss"))],
    [
      "服务器5xx",
      () => Promise.resolve(response(false, { error: "合成服务异常" }, 503)),
    ],
    [
      "非JSON响应",
      () =>
        Promise.resolve({
          ok: true,
          json: async () => {
            throw new Error("synthetic invalid body");
          },
        }),
    ],
    [
      "无结果响应",
      () =>
        Promise.resolve(
          response(true, { message: "synthetic incomplete response" }),
        ),
    ],
  ] as const)(
    "%s结果不明时锁定重发，核对后由本人显式重试",
    async (_label, fail) => {
      const h = harness();
      h.request.mockImplementationOnce(fail);
      await h.submit();
      expect(text(h.getTree())).toContain("操作结果尚未确认");
      expect(h.find((node) => node.type === "button").props.disabled).toBe(
        true,
      );
      expect(
        h.find((node) => node.type === "a" && node.props.target === "_blank")
          .props.href,
      ).toBe("/teams/apply");
      await h.submit();
      expect(h.request).toHaveBeenCalledOnce();
      h.confirm();
      await h.submit();
      expect(h.request).toHaveBeenCalledTimes(2);
      const [, options] = h.request.mock.calls[1];
      expect(JSON.parse((options as { body: string }).body)).toMatchObject({
        operation: "establish",
        gameID: "24",
        title: "合成代表队",
        reason: "合成已填写的组织训练计划",
      });
    },
  );
  it("仅成功返回后确认建队提交并刷新记录", async () => {
    const h = harness();
    h.request.mockResolvedValueOnce(response(true, { result: { id: 81 } }));
    await h.submit();
    expect(text(h.getTree())).toContain("建队申请已提交");
    expect(h.router.refresh).toHaveBeenCalledOnce();
  });
  it.each(["returned", "rejected"])(
    "%s必须有说明，先聚焦审核意见且不调用接口",
    async (decision) => {
      const h = harness("TeamCoreDecision", {
        kind: "join",
        id: 71,
        revision: "synthetic-revision",
      });
      h.values.set("note", "  ");
      await h.submit(decision);
      expect(h.request).not.toHaveBeenCalled();
      expect(h.focus).toHaveBeenCalled();
      expect(text(h.getTree())).toContain("请填写审核意见");
      h.values.set("note", "合成补充说明");
      await h.submit(decision);
      const [, options] = h.request.mock.calls[0];
      expect(JSON.parse((options as { body: string }).body)).toEqual({
        operation: "decide-join",
        id: 71,
        revision: "synthetic-revision",
        decision,
        note: "合成补充说明",
      });
    },
  );
  it("批准可不填说明，仍发送原申请id和revision", async () => {
    const h = harness("TeamCoreDecision", {
      kind: "establishment",
      id: 81,
      revision: "synthetic-revision",
    });
    h.values.set("note", "");
    await h.submit("approved");
    const [, options] = h.request.mock.calls[0];
    expect(JSON.parse((options as { body: string }).body)).toEqual({
      operation: "decide-establishment",
      id: 81,
      revision: "synthetic-revision",
      decision: "approved",
      note: "",
    });
  });
  it("入队草稿结构化拒绝继续抛给问卷，保留回执、题目版本与原答案", async () => {
    const initial = {
      id: 7,
      status: "draft",
      updatedAt: "synthetic-revision",
      formVersion: "synthetic-form",
      formSnapshot: form,
      answers: { game: "合成游戏ID" },
      reviewNote: null,
    };
    const h = harness("TeamCoreApplicant", {
      id: 16,
      form,
      version: "synthetic-form",
      state: "招新开放",
      initial,
    });
    const save = h.find((node) => node.type === "questionnaire").props
      .onSaveDraft as (answers: unknown) => Promise<void>;
    await expect(save(initial.answers)).rejects.toThrow("合成业务拒绝");
    h.render();
    expect(
      h.find((node) => node.type === "questionnaire").props.initialAnswers,
    ).toEqual(initial.answers);
    const [, options] = h.request.mock.calls[0];
    expect(JSON.parse((options as { body: string }).body)).toEqual({
      operation: "save-join",
      id: 16,
      version: "synthetic-form",
      revision: "synthetic-revision",
      action: "draft",
      answers: initial.answers,
    });
  });
});
