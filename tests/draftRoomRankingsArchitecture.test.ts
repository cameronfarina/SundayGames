import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const facade = path.resolve("src/data/draftRoomRankings.ts");
const moduleDirectory = path.resolve("src/data/draftRoomRankings");

const productionFiles = (): readonly string[] => [
  facade,
  ...(existsSync(moduleDirectory)
    ? readdirSync(moduleDirectory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(moduleDirectory, name))
    : []),
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
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("explicit any");
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (/@ts-(?:ignore|expect-error|nocheck)|eslint-disable|prettier-ignore/u.test(text)) {
    findings.push("suppression comment");
  }
  return findings;
};

describe("draft room ranking architecture", () => {
  it("keeps production modules focused and strictly typed", () => {
    for (const file of productionFiles()) {
      const label = path.relative(process.cwd(), file);
      expect(readFileSync(file, "utf8").split("\n").length, label)
        .toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
