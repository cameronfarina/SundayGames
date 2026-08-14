import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = join(process.cwd(), "tests", "platformSimulations");
const files = (): string[] => readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
  .map(entry => join(root, entry.name));

const countLines = (source: string): number => {
  const lines = source.split(/\r?\n/u);
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
};

const inspect = (file: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      problems.push(`${file} contains a type assertion`);
    }
    if (ts.isNonNullExpression(node)) problems.push(`${file} contains a non-null assertion`);
    if (node.kind === ts.SyntaxKind.AnyKeyword) problems.push(`${file} contains explicit any`);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (/@ts-(?:ignore|expect-error|nocheck)/u.test(source)) {
    problems.push(`${file} contains a TypeScript suppression comment`);
  }
  return problems;
};

export const architectureProblems = (): string[] => files().flatMap(file => {
  const source = readFileSync(file, "utf8");
  const lines = countLines(source);
  return [
    ...(lines > 150 ? [`${file} has ${lines} lines; maximum is 150`] : []),
    ...inspect(file, source),
  ];
});

export const behaviorNames = (): string[] => files().flatMap(file => {
  if (!file.endsWith(".test.ts")) return [];
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "it") {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) names.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}).sort();
