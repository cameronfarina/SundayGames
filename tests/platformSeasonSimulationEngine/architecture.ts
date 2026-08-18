import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const focusedMaximumLines = 250;
const absoluteMaximumLines = 400;
const testsDirectory = join(process.cwd(), "tests");
const suiteEntryPath = join(testsDirectory, "platformSeasonSimulationEngine.test.ts");
const suiteDirectory = join(testsDirectory, "platformSeasonSimulationEngine");

const descendantTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return descendantTypeScriptFiles(file);
    return entry.isFile() && entry.name.endsWith(".ts") ? [file] : [];
  });

const ownedFiles = (): string[] => [
  suiteEntryPath,
  ...descendantTypeScriptFiles(suiteDirectory),
];

const lineCount = (source: string): number => {
  const lines = source.split(/\r?\n/u);
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
};

const forbiddenSyntax = (file: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (
      (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node))
      && node.exclamationToken !== undefined
    ) {
      findings.push("definite-assignment assertion");
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("explicit any");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

const suppressionComments = (source: string): string[] => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  const findings: string[] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      (token === ts.SyntaxKind.SingleLineCommentTrivia
        || token === ts.SyntaxKind.MultiLineCommentTrivia)
      && /@ts-(?:ignore|expect-error|nocheck)/u.test(scanner.getTokenText())
    ) {
      findings.push("TypeScript suppression comment");
    }
  }
  return findings;
};

const architectureProblems = (): string[] => ownedFiles().flatMap(file => {
  const source = readFileSync(file, "utf8");
  const lines = lineCount(source);
  const problems = [
    ...forbiddenSyntax(file, source),
    ...suppressionComments(source),
  ].map(problem => `${file}: ${problem}`);
  if (lines > absoluteMaximumLines) {
    problems.unshift(`${file}: ${lines} lines exceeds absolute maximum ${absoluteMaximumLines}`);
  }
  if (lines > focusedMaximumLines) {
    problems.unshift(`${file}: ${lines} lines exceeds focused maximum ${focusedMaximumLines}`);
  }
  return problems;
});

export const registerArchitectureTest = (): void => {
  it("keeps the season simulation tests focused and free of TypeScript escapes", () => {
    const problems = architectureProblems();
    expect(problems, problems.join("\n")).toEqual([]);
  });
};
