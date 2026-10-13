import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APIError } from "payload";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { honorID, honorLabels } from "../src/lib/team-honor-model";
import {
  teamHonorQuery,
  teamHonorReturnQuery,
} from "../src/components/TeamHonorNavigation";
import { workflowFeedback } from "../src/components/activity-pages/action-feedback";

type Values = Record<string, unknown>;
type Element = ReactElement<Values>;
const require = createRequire(import.meta.url);
const source = (path: string) => readFileSync(path, "utf8");
const actionsSource = source("src/app/(frontend)/teams/honors/actions.ts");
const formSource = source("src/components/activity-pages/ActionForm.tsx");
function evaluate(source: string, dependencies: Values, extra: Values = {}) {
  const exports: Values = {};
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(code, {
    exports,
    require: (name: string) => dependencies[name] ?? require(name),
    URLSearchParams,
    Error,
    ...extra,
  });
  return exports;
}
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  return isValidElement<Values>(value)
    ? [value, ...elements(value.props.children)]
    : [];
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  return isValidElement<Values>(value) ? text(value.props.children) : "";
}
const makeForm = () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "27",
    revision: "3",
    submittedVersion: "2",
    note: "  合成需要保留的审核说明  ",
    action: "return",
    returnQuery: "view=review&team=22&game=24",
  }))
    form.set(key, value);
  return form;
};
function actionHarness(authorized = true) {
  const actor = {
    id: 9,
    roles: ["member"],
    communityRoles: [{ game: 24, role: "manager" }],
  };
  const change = vi
    .fn()
    .mockResolvedValue({ privateSyntheticField: "must-not-be-returned" });
  const save = vi
    .fn()
    .mockRejectedValue(new APIError("荣誉已更新，请刷新后核对再保存", 409));
  const revalidate = vi.fn(),
    redirect = vi.fn((path: string) => {
      throw new Error("REDIRECT:" + path);
    });
  const p = {
    auth: vi.fn().mockResolvedValue({ user: actor }),
    findByID: vi.fn(async (options: Values) =>
      options.collection === "honors"
        ? {
            team: 22,
            game: 24,
            verified: true,
            _status: "published",
            updatedAt: "legacy-current",
          }
        : { game: 24 },
    ),
    update: vi.fn(),
    create: vi.fn(),
  };
  const request = { user: actor };
  const transaction = vi.fn(
    async (
      _p: unknown,
      _user: unknown,
      _options: unknown,
      work: (req: unknown) => Promise<unknown>,
    ) => work(request),
  );
  const actions = evaluate(actionsSource, {
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect },
    "next/cache": { revalidatePath: revalidate },
    "@/lib/content": { cms: async () => p },
    "@/lib/team-honor-service": { teamHonorService: { change } },
    "@/lib/team-honor-web": { saveHonorForm: save },
    "@/lib/team-honor-model": { honorID },
    "@/lib/workflow-transactions": { workflowTransaction: transaction },
    "@/lib/rules": {
      canReviewShowcase: () => authorized,
      relationID: (value: unknown) => value,
    },
    payload: { APIError },
    "@/components/TeamHonorNavigation": { teamHonorReturnQuery },
    "@/components/activity-pages/action-feedback": { workflowFeedback },
  });
  return {
    actor,
    change,
    save,
    revalidate,
    redirect,
    p,
    request,
    transaction,
    actions: actions as Record<
      string,
      (form: FormData) => Promise<{
        ok: boolean;
        message: string;
        successHref?: string;
      }>
    >,
  };
}

const record = {
  id: 27,
  author: 8,
  authorName: "合成投稿人",
  team: 22,
  game: 24,
  state: "pending",
  revision: 3,
  submittedVersion: 2,
  title: "合成待审荣誉",
  images: [],
  description: "合成材料",
};
function caller(
  kind: "record" | "legacy",
  actions: Values,
  ActionForm: unknown = "action-form",
) {
  const shared = {
    "next/link": { __esModule: true, default: "a" },
    "./SubmitButton": {
      SubmitButton: (props: Values) =>
        createElement("button", { ...props, type: "submit" }),
    },
    "./activity-pages/ActionForm": { ActionForm },
    "./TeamHonorNavigation": { teamHonorQuery },
    "@/app/(frontend)/teams/honors/actions": actions,
    "@/app/(frontend)/_club/ClubPages.module.css": {},
  };
  if (kind === "record") {
    const component = evaluate(source("src/components/TeamHonorRecord.tsx"), {
      ...shared,
      "@/lib/team-honor-model": { honorLabels },
    }).TeamHonorRecordCard as (props: Values) => ReactElement;
    return createElement(component, { record, reviewer: true });
  }
  const component = evaluate(source("src/components/TeamHonorArchives.tsx"), {
    ...shared,
    "@/lib/rules": { canReviewShowcase: () => true },
    "@/lib/team-honor-service": { teamHonorService: {} },
  }).TeamHonorArchiveContents as (props: Values) => ReactElement;
  return createElement(component, {
    archive: {
      team: { id: 22, game: 24 },
      records: [
        {
          key: "legacy:27",
          legacy: true,
          legacyRevision: "legacy-current",
          title: "合成历史荣誉",
          images: [],
        },
      ],
    },
    user: { id: 9 },
  });
}

function formHarness(
  kind: "record" | "legacy",
  action: (form: FormData) => Promise<unknown>,
) {
  const slots: unknown[] = [];
  let cursor = 0,
    tree: unknown;
  const values = makeForm();
  if (kind === "legacy") values.set("revision", "legacy-current");
  const reset = vi.fn(),
    focus = vi.fn(),
    router = { refresh: vi.fn(), replace: vi.fn() };
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
    useTransition: () => [false, (callback: () => void) => callback()],
  };
  class Button {
    name = "action";
    value = kind === "legacy" ? "hideLegacy" : "return";
  }
  class BrowserFormData {
    constructor() {
      const data = new FormData();
      for (const [key, value] of values) data.set(key, value);
      return data;
    }
  }
  const component = evaluate(
    formSource,
    {
      react: hooks,
      "next/navigation": { useRouter: () => router },
      "./Workspace.module.css": {},
    },
    {
      HTMLButtonElement: Button,
      FormData: BrowserFormData,
      requestAnimationFrame: (callback: () => void) => callback(),
    },
  ).ActionForm as (props: Values) => unknown;
  const outer = caller(kind, {
    changeTeamHonorResultAction: action,
    hideLegacyTeamHonorResultAction: action,
  });
  const rendered = (outer.type as (props: Values) => unknown)(outer.props);
  const call = elements(rendered).find((node) => node.type === "action-form")!;
  function render() {
    cursor = 0;
    tree = component(call.props);
    for (const node of elements(tree)) {
      const ref = node.props.ref as { current: unknown } | undefined;
      if (ref) ref.current = { focus };
    }
  }
  function find(predicate: (node: Element) => boolean) {
    const value = elements(tree).find(predicate);
    expect(value).toBeDefined();
    return value!;
  }
  async function submit() {
    await (
      find((node) => node.type === "form").props.onSubmit as (
        event: unknown,
      ) => Promise<void>
    )({
      preventDefault: vi.fn(),
      currentTarget: { reset },
      nativeEvent: { submitter: new Button() },
    });
    render();
  }
  render();
  return { values, reset, focus, router, find, submit, getTree: () => tree };
}

describe("荣誉网页薄适配保留原服务、CAS与权限边界", () => {
  it("只调用原荣誉服务一次，原身份/id/revision/submittedVersion/说明不变，不回传私有DTO", async () => {
    const h = actionHarness(),
      form = makeForm();
    await expect(h.actions.changeTeamHonorResultAction(form)).resolves.toEqual({
      ok: true,
      message: "已退回，作者可按说明修改后重提。",
    });
    expect(h.change).toHaveBeenCalledExactlyOnceWith(h.p, h.actor, "return", {
      id: 27,
      revision: "3",
      submittedVersion: "2",
      note: "合成需要保留的审核说明",
    });
    expect(h.revalidate.mock.calls).toEqual([
      ["/teams"],
      ["/honors"],
      ["/teams/honors"],
      ["/community", "layout"],
    ]);
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it.each([403, 409])(
    "原服务公开%s拒绝原样返回，不redirect或重试",
    async (status) => {
      const h = actionHarness();
      h.change.mockRejectedValueOnce(
        new APIError("合成审核拒绝，请核对", status),
      );
      await expect(
        h.actions.changeTeamHonorResultAction(makeForm()),
      ).resolves.toEqual({ ok: false, message: "合成审核拒绝，请核对" });
      expect(h.change).toHaveBeenCalledOnce();
      expect(h.redirect).not.toHaveBeenCalled();
      expect(h.revalidate).not.toHaveBeenCalled();
    },
  );
  it("未知异常不泄露数据库详情，也不声称写入失败", async () => {
    const h = actionHarness();
    h.change.mockRejectedValueOnce(
      new Error("SELECT synthetic-private-detail"),
    );
    const result = await h.actions.changeTeamHonorResultAction(makeForm());
    expect(result.ok).toBe(false);
    expect(result.message).toContain("无法确认操作结果");
    expect(result.message).not.toContain("SELECT");
  });
  it("历史荣誉stale revision和越权均不执行更新或审计写入", async () => {
    for (const authorized of [true, false]) {
      const h = actionHarness(authorized),
        form = makeForm();
      const result = await h.actions.hideLegacyTeamHonorResultAction(form);
      expect(result.ok).toBe(false);
      expect(result.message).toContain(
        authorized ? "请刷新后核对" : "无权撤下",
      );
      expect(result).not.toHaveProperty("successHref");
      expect(h.p.update).not.toHaveBeenCalled();
      expect(h.p.create).not.toHaveBeenCalled();
      expect(h.revalidate).not.toHaveBeenCalled();
      expect(h.p.findByID.mock.calls[0][0]).toMatchObject({
        collection: "honors",
        user: null,
        overrideAccess: false,
        draft: false,
      });
    }
  });
  it("历史隐藏按原事务写入审计，成功反馈转到保留筛选的站内页面", async () => {
    const h = actionHarness(),
      form = makeForm();
    form.set("revision", "legacy-current");
    form.set(
      "returnQuery",
      "view=review&team=22&game=24&page=3&next=https://synthetic.invalid&successHref=https://synthetic.invalid",
    );
    const message = "历史荣誉已撤下，原作者、赛季和内容保留。";
    expect(await h.actions.hideLegacyTeamHonorResultAction(form)).toEqual({
      ok: true,
      message,
      successHref:
        "/teams/honors?" +
        new URLSearchParams({
          view: "review",
          team: "22",
          game: "24",
          page: "3",
          message,
        }),
    });
    expect(h.transaction).toHaveBeenCalledOnce();
    expect(h.p.update).toHaveBeenCalledExactlyOnceWith({
      collection: "honors",
      id: 27,
      req: h.request,
      overrideAccess: false,
      data: { _status: "draft", verified: false },
    });
    expect(h.p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "audit",
        req: h.request,
        data: {
          actor: "9",
          object: "honors:27",
          action: "hideLegacy:合成需要保留的审核说明",
          status: "hidden",
        },
      }),
    );
  });
  it("投稿已知拒绝仍返回字段错误，未知异常交给原编辑器核对锁", async () => {
    const h = actionHarness();
    const save = h.actions.saveTeamHonorAction as unknown as (
      previous: Values,
      form: FormData,
    ) => Promise<Values>;
    await expect(save({}, makeForm())).resolves.toEqual({
      error: "荣誉已更新，请刷新后核对再保存",
    });
    h.save.mockRejectedValueOnce(new Error("SELECT synthetic-private-detail"));
    const result = await save({}, makeForm());
    expect(result.unconfirmed).toBe(true);
    expect(result.error).toContain("无法确认操作结果");
    expect(result.error).not.toContain("SELECT");
  });
  it("旧redirect导出仍可用，返回地址只包含服务器确定的站内路径", async () => {
    const h = actionHarness(),
      form = makeForm();
    form.set(
      "returnQuery",
      "view=review&team=22&next=https://synthetic.invalid",
    );
    await expect(h.actions.changeTeamHonorAction(form)).rejects.toThrow(
      "REDIRECT:/teams/honors/27?",
    );
    expect(h.redirect.mock.calls[0][0]).not.toContain("synthetic.invalid");
    expect(h.change).toHaveBeenCalledOnce();
  });
});

describe("荣誉和历史隐藏实际调用ActionForm，SSR与拒绝保值", () => {
  it.each(["record", "legacy"] as const)(
    "%s真实静态渲染为POST，水合前fieldset禁用",
    (kind) => {
      const ActionForm = evaluate(formSource, {
        "next/navigation": { useRouter: () => ({ refresh: vi.fn() }) },
        "./Workspace.module.css": {},
      }).ActionForm;
      const html = renderToStaticMarkup(
        caller(
          kind,
          {
            changeTeamHonorResultAction: vi.fn(),
            hideLegacyTeamHonorResultAction: vi.fn(),
          },
          ActionForm,
        ),
      );
      expect(html).toContain('method="post"');
      expect(html).toMatch(/<fieldset[^>]*disabled=""/);
      expect(html).toContain('name="note"');
    },
  );
  it.each(["record", "legacy"] as const)(
    "%s拒绝后不清空说明、不自动刷新，仅由用户核对刷新",
    async (kind) => {
      const action = vi
        .fn()
        .mockResolvedValue({ ok: false, message: "记录已更新，请刷新后核对" });
      const h = formHarness(kind, action);
      await h.submit();
      expect(text(h.getTree())).toContain("记录已更新，请刷新后核对");
      expect(h.reset).not.toHaveBeenCalled();
      expect(h.router.refresh).not.toHaveBeenCalled();
      expect(h.values.get("note")).toBe("  合成需要保留的审核说明  ");
      expect(action.mock.calls[0][0].get("note")).toBe(h.values.get("note"));
      const refresh = h.find(
        (node) => node.type === "button" && node.props.type === "button",
      );
      (refresh.props.onClick as () => void)();
      expect(h.router.refresh).toHaveBeenCalledOnce();
      expect(h.reset).not.toHaveBeenCalled();
    },
  );
  it("丢失响应保留说明并要求核对，反馈不宣称操作没有保存", async () => {
    const h = formHarness(
      "record",
      vi.fn().mockRejectedValue(new Error("synthetic network")),
    );
    await h.submit();
    expect(text(h.getTree())).toContain("操作结果尚未确认");
    expect(h.reset).not.toHaveBeenCalled();
    expect(h.values.get("note")).toContain("合成需要保留");
  });
  it("成功移出当前列表时导航到服务器给出的回执页，不再刷新失效的原详情", async () => {
    const successHref = "/teams/honors?view=review&message=saved";
    const h = formHarness("legacy", vi.fn().mockResolvedValue({ ok: true, message: "已保存", successHref }));
    await h.submit();
    expect(h.router.replace).toHaveBeenCalledExactlyOnceWith(successHref);
    expect(h.router.refresh).not.toHaveBeenCalled();
    expect(text(h.getTree())).not.toContain("已保存");
    expect(h.reset).not.toHaveBeenCalled();
  });
  it("没有成功目标页时继续刷新当前记录并展示已保存反馈", async () => {
    const h = formHarness("record", vi.fn().mockResolvedValue({ ok: true, message: "审核已保存" }));
    await h.submit();
    expect(h.router.refresh).toHaveBeenCalledOnce();
    expect(h.router.replace).not.toHaveBeenCalled();
    expect(text(h.getTree())).toContain("审核已保存");
  });
  it("失败结果即使带有目标页也不能导航或清空当前说明", async () => {
    const h = formHarness("record", vi.fn().mockResolvedValue({ ok: false, message: "记录已更新，请核对", successHref: "/teams/honors" }));
    await h.submit();
    expect(h.router.replace).not.toHaveBeenCalled();
    expect(h.router.refresh).not.toHaveBeenCalled();
    expect(h.reset).not.toHaveBeenCalled();
    expect(text(h.getTree())).toContain("记录已更新，请核对");
    expect(h.values.get("note")).toContain("合成需要保留");
  });
});
