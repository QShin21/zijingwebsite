import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Node = { text?: string; type?: string; tag?: string; children?: Node[] };
const draft = JSON.parse(
  readFileSync("docs/privacy-page-20261013.json", "utf8"),
);
const markdown = readFileSync("docs/PRIVACY_NOTICE_20261013.md", "utf8");
const body = markdown
  .split("<!-- BEGIN:PRIVACY_NOTICE_BODY -->")[1]
  ?.split("<!-- END:PRIVACY_NOTICE_BODY -->")[0];
const text = (node: Node): string =>
  node.text ?? (node.children || []).map(text).join("");
const paragraphs = (nodes: Node[]): string[] =>
  nodes.flatMap((node) =>
    node.type === "list" ? paragraphs(node.children || []) : [text(node)],
  );

// Evaluate the actual rich-text guard and role predicates without loading
// Payload/config, a real user, CMS, environment files, or a database.
function sourceNode(filename: string, name: string) {
  const source = readFileSync(filename, "utf8");
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const node = tree.statements.find(
    (node) =>
      (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) => declaration.name.getText(tree) === name,
        )),
  );
  if (!node) throw new Error("Actual source node missing: " + name);
  return node.getText(tree);
}
const exports: Record<string, unknown> = {};
const code =
  ["hasRole", "canPublish", "safeURL"]
    .map((name) => sourceNode("src/lib/rules.ts", name))
    .join("\n") +
  "\n" +
  ["guard", "validateRichText"]
    .map((name) => sourceNode("src/collections/index.ts", name))
    .join("\n") +
  "\nexport { guard };";
runInNewContext(
  ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports, URL, routeFor: {}, process: { env: { APP_ENV: "development" } } },
);
type HookInput = {
  data: Record<string, unknown>;
  operation: string;
  req: {
    user: { id: number; roles: string[] };
    context: Record<string, unknown>;
    payload: { findByID: ReturnType<typeof vi.fn> };
  };
  collection: { slug: string };
};
const guard = exports.guard as (
  scoped: boolean,
  self: boolean,
) => (input: HookInput) => Promise<Record<string, unknown>>;
async function saveDraft(data: Record<string, unknown>, role = "president") {
  const findByID = vi.fn(() => {
    throw new Error(
      "CMS/database access prohibited in synthetic draft validation",
    );
  });
  const result = await guard(
    false,
    false,
  )({
    data,
    operation: "create",
    req: {
      user: { id: 9901, roles: [role] },
      context: {},
      payload: { findByID },
    },
    collection: { slug: "pages" },
  });
  expect(findByID).not.toHaveBeenCalled();
  return result;
}

describe("Final privacy draft: canonical body and actual CMS guard, synthetic only", () => {
  it("Markdown publishable body and every Lexical block match without copying operator notes into the page", () => {
    expect(body).toBeTruthy();
    const lines = body
      .trim()
      .split(/\n+/)
      .filter(Boolean)
      .map((line: string) => line.replace(/^(?:## |- )/, ""));
    expect(paragraphs(draft.body.root.children)).toEqual(lines);
    expect(lines.join("\n")).not.toMatch(
      /【待核定|TODO|父任务|本次文档|CMS 草稿|sourceCommit/,
    );
  });
  it("confirmed operator, WeChat and distinct retention policies are in the body, with no automatic-deletion claim", () => {
    const copy = paragraphs(draft.body.root.children).join("\n");
    expect(copy).toContain("叶佳鑫（清华大学学生紫荆电竞社社长）");
    expect(copy).toContain("隐私联系微信为 yejx2003");
    expect(copy).toContain("运营保留政策为 1 年");
    expect(copy).toContain("成员关系记录长期保留");
    expect(copy).toContain("当前系统尚未启用自动到期删除");
    expect(copy).toContain("原始报名答案、联系方式、答卷快照和整份申请资料");
    expect(copy).not.toMatch(/yz167015|保证审核|已经.*到期.*清除/);
  });
  it("CMS proposal stays a draft with one body and no fabricated approval, publication or secret metadata", () => {
    expect(Object.keys(draft).sort()).toEqual(
      [
        "key",
        "title",
        "slug",
        "summary",
        "body",
        "_status",
        "reviewState",
      ].sort(),
    );
    expect(draft).toMatchObject({
      key: "privacy",
      slug: "privacy",
      _status: "draft",
      reviewState: "editing",
    });
    expect(draft.title.length).toBeGreaterThan(0);
    expect(draft).not.toHaveProperty("sections");
  });
  it("the actual Pages rich-text guard accepts the final draft without CMS/database access or state changes", async () => {
    const input = structuredClone(draft);
    expect(await saveDraft(input)).toEqual(draft);
  });
  it("the actual role guard keeps a contributor synthetic save as a draft, never accepting a publication shortcut", async () => {
    const result = await saveDraft(
      { ...structuredClone(draft), _status: "published" },
      "backbone",
    );
    expect(result).toMatchObject({
      _status: "draft",
      reviewState: "editing",
      submittedBy: 9901,
    });
  });
  it("the actual CMS guard still rejects unsupported nodes and unsafe links", async () => {
    const invalid = (children: unknown[]) => ({
      ...structuredClone(draft),
      body: { root: { type: "root", children } },
    });
    await expect(
      saveDraft(invalid([{ type: "made-up-media-node" }])),
    ).rejects.toThrow("不支持的富文本节点");
    await expect(
      saveDraft(
        invalid([
          {
            type: "link",
            fields: { url: "wechat://synthetic-only" },
            children: [],
          },
        ]),
      ),
    ).rejects.toThrow("正文外链必须为 HTTPS");
  });
});
