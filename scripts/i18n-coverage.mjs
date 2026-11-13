// Bilingual coverage inventory for the website: lists Chinese string literals, template
// literals and JSX text that are NOT the Chinese argument of a paired translation
// (t/translate/pair helpers). Comparisons, object keys, server-message maps and comments
// are excluded. Usage: node scripts/i18n-coverage.mjs [--json] [paths...]
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const han = /[㐀-鿿]/;
const pairedCallees = new Set(["t", "tr", "translate", "say", "localizeMessage", "pair"]);
const roots = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|mjs)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) files.push(full);
  }
}
for (const root of roots.length ? roots : ["src/components", "src/app/(frontend)"]) {
  if (fs.statSync(root).isDirectory()) walk(root);
  else files.push(root);
}

function exempt(node) {
  for (let current = node.parent, child = node; current; child = current, current = current.parent) {
    if (ts.isCallExpression(current)) {
      const callee = current.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      if (pairedCallees.has(name) && current.arguments[0] === child) return "paired";
      if (["includes", "has", "startsWith", "endsWith", "test", "indexOf"].includes(name)) return "comparison";
    }
    if (ts.isConditionalExpression(current) && /\b(en|isEn|english|locale|lang)\b/.test(current.condition.getText())) return "paired";
    if (ts.isJsxAttribute(current) && ["zh", "en"].includes(current.name.getText())) return "paired";
    if (ts.isPropertyAssignment(current) && ["zh", "en"].includes(current.name.getText())) return "paired";
    if (ts.isArrayLiteralExpression(current) && current.elements.length === 2 && ts.isStringLiteral(current.elements[1]) && !han.test(current.elements[1].text) && current.elements[0] === child) return "paired";
    if (ts.isBinaryExpression(current) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(current.operatorToken.kind)) return "comparison";
    if (ts.isCaseClause(current) && current.expression === child) return "comparison";
    if (ts.isPropertyAssignment(current) && current.name === child) return "key";
    if (ts.isComputedPropertyName(current)) return "key";
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return "import";
    if (ts.isJsxAttribute(current) && ["value", "data-state", "name", "key"].includes(current.name.getText())) return "value";
    if (ts.isVariableDeclaration(current) && /^(zh|chinese|serverLabels?|messages?|exact|stateKeys)$/i.test(current.name.getText())) return "map";
    if (ts.isBlock(current) || ts.isSourceFile(current)) return null;
  }
  return null;
}

const report = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (!han.test(text)) continue;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings = [];
  const visit = (node) => {
    let value = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
    else if (ts.isTemplateExpression(node)) value = node.getText();
    else if (ts.isJsxText(node)) value = node.text.trim();
    if (value && han.test(value)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line;
      const lines = text.split("\n");
      const marked = /i18n-exempt/.test(lines[line] ?? "") || /i18n-exempt/.test(lines[line - 1] ?? "");
      if (!marked && !exempt(node)) findings.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: value.replace(/\s+/g, " ").slice(0, 60) });
      if (ts.isTemplateExpression(node)) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (findings.length) report.push({ file, count: findings.length, findings });
}
report.sort((a, b) => b.count - a.count);
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  for (const entry of report) console.log(String(entry.count).padStart(4), entry.file);
  console.log("total", report.reduce((sum, entry) => sum + entry.count, 0), "in", report.length, "files");
}
