import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const entrypoint = path.resolve("src/platform/historicalSpreadsheetImport.ts");
const moduleDirectory = path.resolve("src/platform/historicalSpreadsheetImport");

const unsafeSyntaxIn = (file: string): readonly string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

describe("historical spreadsheet import architecture", () => {
  it("separates archive safety and upload contracts", () => {
    expect(existsSync(moduleDirectory)).toBe(true);
    if (!existsSync(moduleDirectory)) return;
    const files = [
      entrypoint,
      ...readdirSync(moduleDirectory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(moduleDirectory, name)),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const label = path.relative(process.cwd(), file);
      expect(source.trimEnd().split("\n").length, label).toBeLessThanOrEqual(250);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
