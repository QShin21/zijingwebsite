import { i18nStub } from "./i18n-stubs";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { isValidElement, type ReactElement } from "react";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

type Values = Record<string, unknown>;
type Element = ReactElement<Values>;
const require = createRequire(import.meta.url);
const source = readFileSync("src/components/TeamHonorEditor.tsx", "utf8");
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
const picture = (name = "synthetic.png", size = 10, type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });
const unmounts = new Set<() => void>();
afterEach(() => {
  for (const unmount of unmounts) unmount();
  unmounts.clear();
});

// Run the shipped TSX action and controlled fields with a synthetic hook boundary.
// This does not replace browser or backend media-ACL tests.
function harness(existingImages = 0) {
  const slots: unknown[] = [],
    effects: (() => void)[] = [];
  const effectSlots = new Map<
    number,
    { dependencies: unknown[]; cleanup?: () => void }
  >();
  let cursor = 0,
    tree: unknown,
    needsRender = false,
    nextObjectURL = 0;
  const focus = vi.fn();
  const objectURLs = {
    createObjectURL: vi.fn((_file: File) =>
      `blob:synthetic-team-honor-${++nextObjectURL}`,
    ),
    revokeObjectURL: vi.fn(),
  };
  const save = vi
    .fn<(previous: Values, data: FormData) => Promise<Values>>()
    .mockResolvedValue({ error: "合成服务拒绝" });
  const hooks = {
    useRef(value: unknown) {
      const index = cursor++;
      slots[index] ??= { current: value };
      return slots[index];
    },
    useState(value: unknown) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof value === "function" ? value() : value;
      return [
        slots[index],
        (next: unknown) => {
          const value = typeof next === "function" ? next(slots[index]) : next;
          if (!Object.is(value, slots[index])) {
            slots[index] = value;
            needsRender = true;
          }
        },
      ];
    },
    useEffect(callback: () => void | (() => void), dependencies: unknown[]) {
      const index = cursor++,
        previous = effectSlots.get(index);
      if (
        !previous ||
        dependencies.length !== previous.dependencies.length ||
        dependencies.some(
          (value, i) => !Object.is(value, previous.dependencies[i]),
        )
      ) {
        effects.push(() => {
          previous?.cleanup?.();
          const cleanup = callback();
          effectSlots.set(index, {
            dependencies,
            cleanup: typeof cleanup === "function" ? cleanup : undefined,
          });
        });
      }
    },
    useActionState(
      callback: (state: Values, data: FormData) => Promise<Values>,
      initial: Values,
    ) {
      const index = cursor++;
      slots[index] ??= initial;
      return [
        slots[index],
        async (data: FormData) => {
          slots[index] = await callback(slots[index] as Values, data);
        },
        false,
      ];
    },
  };
  const exports: Values = {};
  const dependencies: Values = {
    react: hooks,
    "next/navigation": { unstable_rethrow: vi.fn() },
    "@/app/(frontend)/teams/honors/actions": { saveTeamHonorAction: save },
    "./team-pages/TeamPages.module.css": {},
  };
  runInNewContext(compiled, {
    exports,
    require: (name: string) => dependencies[name] ?? i18nStub(name) ?? require(name),
    FormData,
    File,
    URL: objectURLs,
    URLSearchParams,
  });
  const component = exports.TeamHonorEditor as (props: Values) => unknown;
  const record = existingImages
    ? {
        id: 57,
        team: 22,
        revision: "synthetic-revision",
        title: "原荣誉标题",
        images: Array.from({ length: existingImages }, (_, i) => ({
          source: `/synthetic-only/${i}.png`,
          caption: `已存证据${i}`,
        })),
      }
    : undefined;
  function find(predicate: (value: Element) => boolean) {
    const matches = elements(tree).filter(predicate);
    expect(matches).toHaveLength(1);
    const result = matches[0];
    expect(result).toBeDefined();
    return result!;
  }
  function render() {
    let renders = 0;
    do {
      cursor = 0;
      needsRender = false;
      tree = component({
        record,
        memberships: [
          {
            id: 7,
            team: 22,
            teamInfo: { gameTitle: "合成社群", title: "合成代表队" },
          },
        ],
        returnQuery: "team=22&game=24",
      });
      for (const node of elements(tree)) {
        const ref = node.props.ref as { current: unknown } | undefined;
        if (ref && !ref.current) ref.current = { focus, value: "" };
      }
      effects.splice(0).forEach((effect) => effect());
      if (++renders > 20)
        throw new Error("Honor editor VM render did not settle");
    } while (needsRender);
  }
  function change(name: string, value: string) {
    (
      find((node) => node.props.name === name).props.onChange as (
        event: unknown,
      ) => void
    )({ currentTarget: { name, value } });
    render();
  }
  function select(name: "pictures" | "video", files: File[]) {
    (
      find((node) => node.props.name === name).props.onChange as (
        event: unknown,
      ) => void
    )({ target: { files } });
    render();
  }
  function check(name: string, checked: boolean) {
    (
      find((node) => node.props.name === name).props.onChange as (
        event: unknown,
      ) => void
    )({ currentTarget: { name, checked } });
    render();
  }
  async function submit() {
    const data = new FormData();
    for (const node of elements(tree)) {
      const name = node.props.name;
      if (
        typeof name !== "string" ||
        node.type === "button" ||
        node.props.type === "file"
      )
        continue;
      if (node.props.type === "checkbox") {
        if (node.props.checked) data.set(name, "on");
      } else data.set(name, String(node.props.value ?? ""));
    }
    data.set("action", "submit");
    await (
      find((node) => node.type === "form").props.action as (
        data: FormData,
      ) => Promise<void>
    )(data);
    render();
  }
  unmounts.add(() => {
    for (const effect of effectSlots.values()) effect.cleanup?.();
  });
  render();
  return {
    save,
    find,
    render,
    change,
    select,
    check,
    submit,
    ownRecordsLink: () =>
      find(
        (node) =>
          node.type === "a" &&
          node.props.target === "_blank" &&
          text(node) === "查看本人荣誉记录",
      ),
    getTree: () => tree,
  };
}

describe("荣誉投稿附件与失败恢复：实际 TSX，合成 action 边界", () => {
  it("已有证据与新图片合计最多六份，勾选移除已有图片才释放名额", async () => {
    const h = harness(6),
      file = picture();
    h.select("pictures", [file]);
    h.change("newCaption-0", "合成新证据");
    await h.submit();
    expect(h.save).not.toHaveBeenCalled();
    expect(text(h.getTree())).toContain("证据图片最多 6 份");
    h.check("removeImage-0", true);
    await h.submit();
    expect(h.save).toHaveBeenCalledOnce();
    const body = h.save.mock.calls[0][1];
    expect(body.get("pictures")).toBe(file);
    expect(body.get("removeImage-0")).toBe("on");
    expect(body.get("id")).toBe("57");
    expect(body.get("revision")).toBe("synthetic-revision");
  });
  it.each([
    [
      "超限图片",
      [picture("large.png", 2 * 1024 * 1024 + 1)],
      undefined,
      "每份证据图片须为 2 MB",
    ],
    [
      "错误图片类型",
      [picture("file.svg", 10, "image/svg+xml")],
      undefined,
      "每份证据图片须为 2 MB",
    ],
    [
      "超限视频",
      [],
      picture("large.mp4", 10 * 1024 * 1024 + 1, "video/mp4"),
      "视频证据须在 10 MB",
    ],
    [
      "合计超限",
      [
        picture("one.png", 2 * 1024 * 1024),
        picture("two.png", 2 * 1024 * 1024),
      ],
      picture("clip.mp4", 9 * 1024 * 1024, "video/mp4"),
      "附件",
    ],
  ] as const)(
    "%s在调用服务前拒绝，保留标题与文件选择",
    async (_label, files, video, expected) => {
      const h = harness();
      h.change("title", "合成已填标题");
      h.select("pictures", [...files]);
      if (video) h.select("video", [video]);
      await h.submit();
      expect(h.save).not.toHaveBeenCalled();
      expect(text(h.getTree())).toContain(expected);
      expect(h.find((node) => node.props.name === "title").props.value).toBe(
        "合成已填标题",
      );
      if (files.length) expect(text(h.getTree())).toContain(files[0].name);
      if (video) expect(text(h.getTree())).toContain(video.name);
    },
  );
  it("结构化拒绝保留完整输入和原 File 对象，修正后原文件仍可重试", async () => {
    const h = harness(),
      file = picture();
    h.change("title", "合成已填标题");
    h.select("pictures", [file]);
    h.change("newCaption-0", "合成说明");
    await h.submit();
    expect(text(h.getTree())).toContain("合成服务拒绝");
    expect(h.find((node) => node.props.name === "title").props.value).toBe(
      "合成已填标题",
    );
    expect(
      h.find((node) => node.props.name === "newCaption-0").props.value,
    ).toBe("合成说明");
    await h.submit();
    expect(h.save).toHaveBeenCalledTimes(2);
    for (const [, body] of h.save.mock.calls) {
      expect(body.get("pictures")).toBe(file);
      expect(body.get("newCaption-0")).toBe("合成说明");
    }
  });
  it("服务返回结果不明时锁定提交，再次未知结果会重新要求核对", async () => {
    const h = harness(),
      file = picture();
    h.save.mockResolvedValue({
      error: "合成服务无法确认操作结果",
      unconfirmed: true,
    });
    h.change("title", "合成保留标题");
    h.select("pictures", [file]);
    h.change("newCaption-0", "合成保留说明");
    await h.submit();
    expect(
      h.find((node) => node.type === "button" && node.props.value === "submit")
        .props.disabled,
    ).toBe(true);
    expect(h.ownRecordsLink().props.href).toContain("team=22");
    const confirmation = h.find(
      (node) =>
        node.type === "input" &&
        node.props.type === "checkbox" &&
        !node.props.name,
    );
    (confirmation.props.onChange as (event: unknown) => void)({
      currentTarget: { checked: true },
    });
    h.render();
    await h.submit();
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(
      h.find((node) => node.type === "button" && node.props.value === "submit")
        .props.disabled,
    ).toBe(true);
    expect(
      h.find(
        (node) =>
          node.type === "input" &&
          node.props.type === "checkbox" &&
          !node.props.name,
      ).props.checked,
    ).toBe(false);
    expect(h.save.mock.calls[1][1].get("pictures")).toBe(file);
    expect(h.find((node) => node.props.name === "title").props.value).toBe(
      "合成保留标题",
    );
  });
  it("断网结果不明时阻止重发，核对本人记录后才允许显式重试", async () => {
    const h = harness(),
      file = picture();
    h.save.mockRejectedValueOnce(new Error("synthetic network loss"));
    h.change("title", "合成荣誉");
    h.select("pictures", [file]);
    h.change("newCaption-0", "合成说明");
    await h.submit();
    expect(
      h.find((node) => node.type === "button" && node.props.value === "submit")
        .props.disabled,
    ).toBe(true);
    expect(h.ownRecordsLink().props.href).toContain(
      "view=mine",
    );
    await h.submit();
    expect(h.save).toHaveBeenCalledOnce();
    const confirmation = h.find(
      (node) =>
        node.type === "input" &&
        node.props.type === "checkbox" &&
        !node.props.name,
    );
    (confirmation.props.onChange as (event: unknown) => void)({
      currentTarget: { checked: true },
    });
    h.render();
    expect(
      h.find((node) => node.type === "button" && node.props.value === "submit")
        .props.disabled,
    ).toBe(false);
    await h.submit();
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.save.mock.calls[1][1].get("pictures")).toBe(file);
  });
});
