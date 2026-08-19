import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const behaviorNames = [
  "marks the first wide-sheet roster row as keepers only when requested",
  "does not assume the first roster row contains keepers",
  "keeps incomplete wide-sheet player cells for downstream validation",
  "keeps the existing row-oriented format and normalizes DEF to DST",
  "auto-detects tab and semicolon delimiters from alias headers",
  "parses quoted CSV cells without splitting embedded delimiters",
  "leaves blank and invalid prices undefined for downstream validation",
  "parses keeper booleans from commissioner-friendly tokens",
  "uses a stable sha256 file hash across trailing source whitespace",
  "rejects delimited sources that exceed row or cell limits",
  "reads a position, a rank and a price into a slot sale",
  "reads a slot written as one cell",
  "keeps a season column so one sheet can carry several drafts",
  "names no owner it could be confused with, and never a real player",
  "marks every slot an auction sale rather than leaving it inferred",
  "leaves a slot deeper than the published board without a published value",
  "keeps kicker and defense slots without giving them a published value",
  "warns about a row with no readable rank and leaves it unnamed",
  "keeps an unreadable price for the row validation to reject",
  "skips a blank row without warning about it",
  "reads tab separated slot prices",
  "leaves a sheet that names players to the header-mapped layout",
  "leaves a wide auction sheet to the wide layout",
  "reads repeated position player price groups as ranked slot prices",
];

const testDirectory = path.resolve("tests/platformHistoricalImportSource");
const testFiles = readdirSync(testDirectory)
  .filter(file => file.endsWith(".test.ts"))
  .map(file => path.join(testDirectory, file));

const sourceFileFor = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

const collectBehaviorNames = (sourceFile: ts.SourceFile): readonly string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.arguments[0];
      if (node.expression.text === "it" && name !== undefined && ts.isStringLiteralLike(name)) {
        names.push(name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
};

const countAssertions = (sourceFile: ts.SourceFile): number => {
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "expect"
    ) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
};

const unsafeSyntax = (sourceFile: ts.SourceFile): readonly string[] => {
  const violations: string[] = [];
  const forbidden: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.AnyKeyword,
    ts.SyntaxKind.AsExpression,
    ts.SyntaxKind.NonNullExpression,
    ts.SyntaxKind.TypeAssertionExpression,
  ]);
  const visit = (node: ts.Node): void => {
    if (forbidden.has(node.kind)) violations.push(ts.SyntaxKind[node.kind] ?? "unknown");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
};

describe("platform historical import source test architecture", () => {
  it("preserves every historical import parsing behavior and assertion", () => {
    const sourceFiles = testFiles.map(sourceFileFor);
    const actualNames = sourceFiles.flatMap(collectBehaviorNames).sort();
    const assertionCount = sourceFiles.reduce(
      (total, sourceFile) => total + countAssertions(sourceFile),
      0,
    );

    expect(actualNames).toEqual([...behaviorNames].sort());
    expect(assertionCount).toBe(44);
  });

  it("keeps historical import tests focused and free of unsafe type escapes", () => {
    const violations = testFiles.flatMap(file => {
      const source = sourceFileFor(file);
      const lines = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
      const findings = unsafeSyntax(source).map(finding => `${path.basename(file)}: ${finding}`);
      return lines > 150 ? [`${path.basename(file)}: ${lines} lines`, ...findings] : findings;
    });

    expect(violations).toEqual([]);
  });
});
