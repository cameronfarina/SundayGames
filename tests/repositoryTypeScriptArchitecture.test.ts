import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const runtimeRoots: readonly string[] = ["config", "scripts", "src", "web/src"];

const sourceFilesUnder = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(file);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [file] : [];
  });

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

  const suppression = /@ts-(?:ignore|expect-error|nocheck)|(?:eslint|oxlint)-disable|biome-ignore/u;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      (token === ts.SyntaxKind.SingleLineCommentTrivia
        || token === ts.SyntaxKind.MultiLineCommentTrivia)
      && suppression.test(scanner.getTokenText())
    ) {
      findings.push("suppression comment");
    }
  }
  return findings;
};

describe("production TypeScript architecture", () => {
  it("keeps shipped modules focused and removes unsafe type escapes", () => {
    const violations: string[] = [];
    for (const rootName of runtimeRoots) {
      const root = path.resolve(rootName);
      if (!existsSync(root)) continue;
      for (const file of sourceFilesUnder(root)) {
        const label = path.relative(process.cwd(), file);
        const lines = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
        if (lines > 150) {
          violations.push(`${label}: ${lines} lines exceeds 150`);
        }
        for (const finding of unsafeSyntaxIn(file)) {
          violations.push(`${label}: ${finding}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
