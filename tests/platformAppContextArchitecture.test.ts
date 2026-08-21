import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = path.resolve("src/platform/app/context");
const contextTests = readdirSync(path.resolve("tests"), { encoding: "utf8" })
  .filter(entry => entry.startsWith("platformAppContext") && entry.endsWith(".ts"))
  .map(entry => path.resolve("tests", entry));
const files = [
  path.resolve("src/platform/app/context.ts"),
  ...readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter(entry => entry.endsWith(".ts"))
    .map(entry => path.join(directory, entry)),
  ...contextTests,
];

const forbiddenKinds = new Set([
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.TypeAssertionExpression,
]);

const unsafeTypeSyntax = (source: string, file: string): readonly string[] => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (forbiddenKinds.has(node.kind)) violations.push(ts.SyntaxKind[node.kind] ?? "unknown");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const suppressionPrefix = ["@ts", "-"].join("");
  if (source.includes(`${suppressionPrefix}ignore`)) violations.push("ignore suppression");
  if (source.includes(`${suppressionPrefix}expect-error`)) violations.push("expect-error suppression");
  return violations;
};

describe("platform app context architecture", () => {
  it("keeps context modules focused and free of unsafe type escapes", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source.split("\n").length, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
      expect(unsafeTypeSyntax(source, file), path.relative(process.cwd(), file)).toEqual([]);
    }
  });
});
