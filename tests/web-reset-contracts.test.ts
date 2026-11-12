import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import baseline from "./fixtures/web-reset-contract-baseline-20261110.json";

/** Entry-point checks supplement, and do not replace, the behavioral suites. */
function exportedNames(file: string): Set<string> {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const entry of statement.exportClause.elements)
        names.add(entry.name.text);
      continue;
    }
    if (
      !ts.canHaveModifiers(statement) ||
      !ts.getModifiers(statement)?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    )
      continue;
    if (ts.isFunctionDeclaration(statement) && statement.name)
      names.add(statement.name.text);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
    }
  }
  return names;
}

describe("web redesign keeps existing entry-point contracts", () => {
  it.each(baseline.pages)("retains the existing page %s", (file) => {
    expect(existsSync(file)).toBe(true);
  });

  it.each(baseline.routes)(
    "retains HTTP methods for $file",
    ({ file, methods }) => {
      const actual = exportedNames(file);
      for (const method of methods) expect(actual.has(method), method).toBe(true);
    },
  );

  it.each(baseline.actions)(
    "retains Server Actions for $file",
    ({ file, exports }) => {
      const source = readFileSync(file, "utf8");
      const actual = exportedNames(file);
      expect(source).toMatch(/^[\s]*["']use server["'];/);
      for (const name of exports) expect(actual.has(name), name).toBe(true);
    },
  );
});
