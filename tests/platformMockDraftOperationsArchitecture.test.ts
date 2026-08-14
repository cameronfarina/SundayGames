import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const facade = path.resolve("src/platform/app/operations/mockDraftOperations.ts");
const moduleDirectory = path.resolve("src/platform/app/operations/mockDraftOperations");

const violationsFor = (file: string): readonly string[] => {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      violations.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) violations.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) violations.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
};

describe("platform mock draft operations architecture", () => {
  it("keeps private mock operations in focused, strictly typed modules", () => {
    expect(existsSync(moduleDirectory)).toBe(true);
    if (!existsSync(moduleDirectory)) return;
    const files = [
      facade,
      ...readdirSync(moduleDirectory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(moduleDirectory, name)),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const label = path.relative(process.cwd(), file);
      expect(source.trimEnd().split("\n").length, label).toBeLessThanOrEqual(150);
      expect(violationsFor(file), label).toEqual([]);
    }
  });
});
