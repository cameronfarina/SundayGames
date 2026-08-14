import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const productionFiles = [
  "src/liveDraftServer/routes/mockAdvanceRoute.ts",
  "src/liveDraftServer/routes/mockAdvanceMutation.ts",
];

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

describe("mock advance route architecture", () => {
  it("separates transport handling from command mutation", () => {
    for (const relativeFile of productionFiles) {
      const file = path.resolve(relativeFile);
      const source = readFileSync(file, "utf8");
      expect(source.trimEnd().split("\n").length, relativeFile).toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), relativeFile).toEqual([]);
    }
  });
});
