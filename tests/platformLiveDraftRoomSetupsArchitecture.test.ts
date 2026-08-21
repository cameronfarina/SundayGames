import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/platform/liveDraftRoomSetups");

const unsafeSyntax = (source: string, fileName: string): string[] => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) violations.push(node.getText(sourceFile));
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
};

describe("live draft room setup architecture", () => {
  it("keeps setup persistence focused and free of unchecked assertions", () => {
    const files = [
      path.resolve("src/platform/liveDraftRoomSetups.ts"),
      ...readdirSync(directory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(directory, name)),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source.split("\n").length, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
      expect(unsafeSyntax(source, file), path.relative(process.cwd(), file)).toEqual([]);
    }
  });
});
