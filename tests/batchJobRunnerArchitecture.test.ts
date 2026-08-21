import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const moduleDirectory = path.resolve("src/liveDraftServer");

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

describe("batch job runner architecture", () => {
  it("keeps each runner responsibility focused", () => {
    const files = readdirSync(moduleDirectory)
      .filter(name => name.startsWith("batchJobRunner") && name.endsWith(".ts"))
      .map(name => path.join(moduleDirectory, name));

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const lineCount = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
      expect(unsafeSyntaxIn(file), path.relative(process.cwd(), file)).toEqual([]);
    }
  });
});
