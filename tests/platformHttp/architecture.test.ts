import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const legacyTest = path.resolve("tests/platformHttp.test.ts");
const familyDirectory = path.resolve("tests/platformHttp");

const typescriptFilesBelow = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFilesBelow(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  });

const unsafeSyntaxIn = (file: string): readonly string[] => {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const record = (label: string, node: ts.Node): void => {
    const location = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push(`${label} at line ${location.line + 1}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      record("type assertion", node);
    }
    if (ts.isNonNullExpression(node)) record("non-null assertion", node);
    if (node.kind === ts.SyntaxKind.AnyKeyword) record("any keyword", node);
    ts.forEachChild(node, visit);
  };
  visit(source);

  const comments = text.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu) ?? [];
  const suppression = /@ts-(?:ignore|expect-error|nocheck)|eslint-(?:disable|enable)|biome-ignore|oxlint-disable|istanbul ignore|c8 ignore/u;
  if (comments.some(comment => suppression.test(comment))) {
    findings.push("suppression comment");
  }
  return findings;
};

describe("platform HTTP test architecture", () => {
  it("keeps the test family strictly typed", () => {
    expect(existsSync(legacyTest), "legacy platform HTTP test").toBe(false);
    const files = typescriptFilesBelow(familyDirectory);

    for (const file of files) {
      const label = path.relative(process.cwd(), file);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
