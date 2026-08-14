import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/platform/seasonSimulationWorkerThread");
const entrypoint = path.resolve("src/platform/seasonSimulationWorkerThread.ts");
const behaviorTest = path.resolve("tests/platformSeasonSimulationWorkerThread.test.ts");
const architectureTest = path.resolve(
  "tests/platformSeasonSimulationWorkerThreadArchitecture.test.ts",
);

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
  if (comments.some(comment => /@ts-(?:ignore|expect-error|nocheck)/u.test(comment))) {
    findings.push("TypeScript suppression");
  }
  return findings;
};

describe("season simulation worker thread architecture", () => {
  it("keeps worker responsibilities focused and strictly typed", () => {
    const files = [
      entrypoint,
      ...readdirSync(directory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(directory, name)),
      behaviorTest,
      architectureTest,
    ];

    for (const file of files) {
      const label = path.relative(process.cwd(), file);
      expect(readFileSync(file, "utf8").split("\n").length, label).toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
