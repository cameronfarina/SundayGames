import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/platform/auction/configuration");
const files = (): readonly string[] => [
  path.resolve("src/platform/auction/configuration.ts"),
  ...readdirSync(directory)
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(directory, name)),
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

describe("auction configuration architecture", () => {
  it("keeps each configuration concern focused", () => {
    for (const file of files()) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), path.relative(process.cwd(), file)).toEqual([]);
    }
  });
});
