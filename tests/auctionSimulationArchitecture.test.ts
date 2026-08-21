import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const auctionEngineDirectory = path.resolve("src/modeling/auctionEngine");

const ownedFiles = (): readonly string[] => [
  ...readdirSync(auctionEngineDirectory)
    .filter(name => /^simulation.*\.ts$/u.test(name))
    .map(name => path.join(auctionEngineDirectory, name)),
  path.resolve("tests/auctionSimulationArchitecture.test.ts"),
];

const unsafeSyntaxIn = (file: string): readonly string[] => {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
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
  const comments = text.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu) ?? [];
  if (comments.some(comment => /@ts-(?:ignore|expect-error)/u.test(comment))) {
    findings.push("TypeScript suppression");
  }
  return findings;
};

describe("auction simulation architecture", () => {
  it("keeps simulation modules focused and strictly typed", () => {
    for (const file of ownedFiles()) {
      const source = readFileSync(file, "utf8");
      const label = path.relative(process.cwd(), file);
      expect(source.trimEnd().split("\n").length, label).toBeLessThanOrEqual(250);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
