import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const facade = path.resolve("src/platform/app/store/InMemoryPlatformStore.ts");
const directory = path.resolve("src/platform/app/store/InMemoryPlatformStore");

const unsafeSyntax = (source: string, fileName: string): string[] => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || node.kind === ts.SyntaxKind.AnyKeyword
    ) {
      violations.push(node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
};

describe("in-memory platform store architecture", () => {
  it("keeps the public facade small and store modules focused and assertion-free", () => {
    const modules = existsSync(directory)
      ? readdirSync(directory).filter(name => name.endsWith(".ts")).map(name => path.join(directory, name))
      : [];

    expect(readFileSync(facade, "utf8").split("\n").length).toBeLessThanOrEqual(100);
    for (const file of [facade, ...modules]) {
      const source = readFileSync(file, "utf8");
      expect(source.split("\n").length, path.relative(process.cwd(), file)).toBeLessThanOrEqual(150);
      expect(unsafeSyntax(source, file), path.relative(process.cwd(), file)).toEqual([]);
      expect(source, path.relative(process.cwd(), file)).not.toMatch(/@ts-|eslint-(?:disable|enable)/u);
    }
  });
});
