import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const productionFiles = [
  "src/platform/auction/pricing.ts",
  "src/platform/auction/ownerSurplus.ts",
  "src/platform/auction/backupDepth.ts",
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

describe("auction pricing architecture", () => {
  it("keeps price projection separate from focused bid policy", () => {
    for (const relativeFile of productionFiles) {
      const file = path.resolve(relativeFile);
      const source = readFileSync(file, "utf8");
      expect(source.trimEnd().split("\n").length, relativeFile).toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), relativeFile).toEqual([]);
    }
  });
});
