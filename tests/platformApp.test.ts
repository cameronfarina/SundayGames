import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  expectedAssertionCount,
  expectedAssertionFingerprint,
  expectedBehaviorNames,
} from "./platformApp/parity.js";

const platformAppDirectory = path.resolve("tests/platformApp");
const maximumLines = 400;

const sourceFilesUnder = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(file);
    return entry.name.endsWith(".ts") ? [file] : [];
  });

const platformAppFiles = [
  path.resolve("tests/platformApp.test.ts"),
  ...sourceFilesUnder(platformAppDirectory),
];
const behaviorFiles = sourceFilesUnder(platformAppDirectory)
  .filter(file => file.endsWith(".test.ts"));

const sourceFileFor = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

const unsafeTypeSyntax = (sourceFile: ts.SourceFile): readonly string[] => {
  const violations: string[] = [];
  const forbiddenKinds: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.AnyKeyword,
    ts.SyntaxKind.AsExpression,
    ts.SyntaxKind.NonNullExpression,
    ts.SyntaxKind.TypeAssertionExpression,
  ]);
  const visit = (node: ts.Node): void => {
    if (forbiddenKinds.has(node.kind)) violations.push(ts.SyntaxKind[node.kind] ?? "unknown");
    if (ts.isPropertyDeclaration(node) && node.exclamationToken !== undefined) {
      violations.push("definite assignment assertion");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const suppression = ["@ts", "-(?:ignore|expect-error|nocheck)"].join("");
  const suppressionPattern = new RegExp(suppression, "u");
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    sourceFile.text,
  );
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const isComment = token === ts.SyntaxKind.SingleLineCommentTrivia
      || token === ts.SyntaxKind.MultiLineCommentTrivia;
    if (isComment && suppressionPattern.test(scanner.getTokenText())) {
      violations.push("TypeScript suppression comment");
    }
  }
  return violations;
};

const behaviorNamesIn = (sourceFile: ts.SourceFile): readonly string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "it") {
      const title = node.arguments[0];
      if (title !== undefined && ts.isStringLiteralLike(title)) names.push(title.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
};

const directlyContainsExpect = (expression: ts.Expression): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found || ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node)) {
      const target = node.expression;
      if (
        (ts.isIdentifier(target) && target.text === "expect")
        || (ts.isPropertyAccessExpression(target)
          && ts.isIdentifier(target.expression)
          && target.expression.text === "expect")
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
};

const assertionStatementsIn = (sourceFile: ts.SourceFile): readonly string[] => {
  const assertions: string[] = [];
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const visit = (node: ts.Node): void => {
    if (ts.isExpressionStatement(node) && directlyContainsExpect(node.expression)) {
      assertions.push(printer.printNode(ts.EmitHint.Unspecified, node, sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return assertions;
};

describe("platform app test architecture", () => {
  it("keeps extracted modules focused and free of unsafe type escapes", () => {
    const violations: string[] = [];
    for (const file of platformAppFiles) {
      const label = path.relative(process.cwd(), file);
      const lines = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
      if (lines > maximumLines) violations.push(`${label}: ${lines} lines exceeds ${maximumLines}`);
      for (const finding of unsafeTypeSyntax(sourceFileFor(file))) {
        violations.push(`${label}: ${finding}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("preserves every platform app behavior name and assertion", () => {
    const sourceFiles = behaviorFiles.map(sourceFileFor);
    const behaviorNames = sourceFiles.flatMap(behaviorNamesIn).sort();
    const assertions = sourceFiles.flatMap(assertionStatementsIn).sort();
    const fingerprint = createHash("sha256").update(assertions.join("\n---\n")).digest("hex");

    expect(behaviorNames).toEqual([...expectedBehaviorNames].sort());
    expect(assertions).toHaveLength(expectedAssertionCount);
    expect(fingerprint).toBe(expectedAssertionFingerprint);
  });
});
