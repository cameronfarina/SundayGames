import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/platform/auction/settlement");

const unsafeSyntax = (source: string, fileName: string): string[] => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      violations.push(node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
};

describe("auction settlement architecture", () => {
  it("keeps nomination bidding and sale settlement focused and assertion-free", () => {
    const files = [
      path.resolve("src/platform/auction/settlement.ts"),
      ...(existsSync(directory) ? readdirSync(directory) : [])
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(directory, name)),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source.split("\n").length, path.relative(process.cwd(), file))
        .toBeLessThanOrEqual(150);
      expect(unsafeSyntax(source, file), path.relative(process.cwd(), file)).toEqual([]);
    }
  });
});
