import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/platform/seasonSnakeMock");
const entrypoint = path.resolve("src/platform/seasonSnakeMock.ts");

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
  const suppression = /@ts-(?:ignore|expect-error|nocheck)|(?:eslint|oxlint)-disable|biome-ignore|prettier-ignore/u;
  if (comments.some(comment => suppression.test(comment))) {
    findings.push("suppression comment");
  }
  return findings;
};

const productionFiles: readonly string[] = [
  entrypoint,
  ...readdirSync(directory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(directory, name)),
];

describe("season snake mock architecture", () => {
  it("keeps configuration and command replay focused and strictly typed", () => {
    for (const file of productionFiles) {
      const label = path.relative(process.cwd(), file);
      expect(readFileSync(file, "utf8").split("\n").length, label).toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
