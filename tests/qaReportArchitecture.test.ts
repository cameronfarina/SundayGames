import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const productionFiles = (): string[] => {
  const root = join(process.cwd(), "src/modeling/qaReport");
  const facade = join(process.cwd(), "src/modeling/qaReport.ts");
  const modules = existsSync(root)
    ? readdirSync(root).map(entry => join(root, entry))
    : [];
  return [facade, ...modules];
};

const unsafeSyntax = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      node.kind === ts.SyntaxKind.AnyKeyword
    ) {
      findings.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

describe("QA report architecture", () => {
  it("keeps production modules focused and free of unsafe type escapes", () => {
    for (const file of productionFiles()) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(150);
      expect(unsafeSyntax(file), file).toEqual([]);
    }
  });
});
