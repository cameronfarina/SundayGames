import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/modeling/auctionEngine/budgetStrategy");

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

  if (/@ts-(?:ignore|expect-error|nocheck)/u.test(text)) {
    findings.push("TypeScript suppression");
  }
  return findings;
};

describe("auction budget strategy architecture", () => {
  it("keeps budget concerns focused and type safe", () => {
    expect(existsSync(directory)).toBe(true);
    if (!existsSync(directory)) return;

    const files = [
      path.resolve("src/modeling/auctionEngine/budgetStrategy.ts"),
      ...readdirSync(directory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(directory, name)),
      path.resolve("tests/auctionBudgetStrategy.test.ts"),
      path.resolve("tests/auctionBudgetStrategyArchitecture.test.ts"),
    ];

    for (const file of files) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(250);
      expect(unsafeSyntaxIn(file), file).toEqual([]);
    }
  });
});
