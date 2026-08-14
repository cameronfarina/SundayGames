import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const moduleRoot = join(process.cwd(), "src/platform/platformMigrations");
const facadePath = join(process.cwd(), "src/platform/platformMigrations.ts");

const sourcePaths = (): readonly string[] => [
  facadePath,
  ...readdirSync(moduleRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && extname(entry.name) === ".ts")
    .map(entry => join(moduleRoot, entry.name)),
];

const forbiddenSyntax = (path: string): readonly string[] => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || node.kind === ts.SyntaxKind.AnyKeyword
    ) {
      findings.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

describe("platform migration architecture", () => {
  it("keeps migration modules focused and free of unsafe TypeScript escape hatches", () => {
    const paths = sourcePaths();
    const oversized = paths.filter(path => readFileSync(path, "utf8").split("\n").length > 150);
    const forbidden = paths.flatMap(forbiddenSyntax);

    expect(oversized).toEqual([]);
    expect(forbidden).toEqual([]);
  });
});
