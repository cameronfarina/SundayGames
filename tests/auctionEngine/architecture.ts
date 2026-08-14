import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const maximumLines = 250;
const testsDirectory = join(process.cwd(), "tests");
const suiteEntryPath = join(testsDirectory, "auctionEngine.test.ts");
const suiteDirectory = join(testsDirectory, "auctionEngine");

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });

const ownedFiles = (): string[] => [suiteEntryPath, ...collectTypeScriptFiles(suiteDirectory)].sort();

const lineCount = (source: string): number => {
  const lines = source.split(/\r?\n/u);
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
};

const bannedSyntaxName = (node: ts.Node): string | undefined => {
  if (ts.isAsExpression(node)) return "as expression";
  if (ts.isTypeAssertionExpression(node)) return "angle-bracket assertion";
  if (ts.isNonNullExpression(node)) return "non-null assertion";
  if (node.kind === ts.SyntaxKind.AnyKeyword) return "explicit any";
  return undefined;
};

const syntaxProblems = (filePath: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];

  const visit = (node: ts.Node): void => {
    const bannedSyntax = bannedSyntaxName(node);

    if (bannedSyntax) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      problems.push(`${filePath}:${location.line + 1} contains ${bannedSyntax}`);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  const suppressionPattern = new RegExp(["@", "ts-(?:ignore|expect-error|nocheck)\\b"].join(""), "u");
  if (suppressionPattern.test(source)) problems.push(`${filePath} contains a TypeScript suppression comment`);
  return problems;
};

export const findOwnedArchitectureProblems = (): string[] =>
  ownedFiles().flatMap(filePath => {
    const source = readFileSync(filePath, "utf8");
    const problems = syntaxProblems(filePath, source);
    const lines = lineCount(source);
    if (lines > maximumLines) problems.unshift(`${filePath} has ${lines} lines; maximum is ${maximumLines}`);
    return problems;
  });

export const collectBehaviorTestNames = (): string[] =>
  ownedFiles().flatMap(filePath => {
    if (!filePath.endsWith(".test.ts")) return [];

    const source = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
    const names: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "it") {
        const name = node.arguments[0];
        if (name && ts.isStringLiteral(name)) names.push(name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return names;
  });
