import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const facade = path.resolve("src/platform/auction/commands.ts");
const moduleDirectory = path.resolve("src/platform/auction/commands");
const commandFiles = (): readonly string[] => [
  facade,
  ...(existsSync(moduleDirectory) ? readdirSync(moduleDirectory) : [])
    .filter(name => name.endsWith(".ts"))
    .map(name => path.join(moduleDirectory, name)),
];

const unsafeSyntaxIn = (file: string): readonly string[] => {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (/@ts-|eslint-disable/u.test(source)) findings.push("suppression");
  return findings;
};

describe("auction command architecture", () => {
  it("keeps command dispatch and transitions focused", () => {
    for (const file of commandFiles()) {
      const lineCount = readFileSync(file, "utf8").split("\n").length;
      expect(lineCount, path.relative(process.cwd(), file)).toBeLessThanOrEqual(250);
    }
  });

  it("does not use TypeScript escape hatches", () => {
    for (const file of commandFiles()) {
      expect(unsafeSyntaxIn(file), path.relative(process.cwd(), file)).toEqual([]);
    }
  });
});
