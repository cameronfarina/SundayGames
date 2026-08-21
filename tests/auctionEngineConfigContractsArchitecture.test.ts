import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/modeling/auctionEngine/configContracts");

const ownedFiles = (): readonly string[] => [
  path.resolve("src/modeling/auctionEngine/configContracts.ts"),
  ...readdirSync(directory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(directory, name)),
  path.resolve("tests/auctionEngineConfigContractsArchitecture.test.ts"),
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

describe("auction engine configuration contract architecture", () => {
  it("keeps contract families focused and strictly typed", () => {
    for (const file of ownedFiles()) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
      expect(unsafeSyntaxIn(file), path.relative(process.cwd(), file)).toEqual([]);
    }
  });
});
