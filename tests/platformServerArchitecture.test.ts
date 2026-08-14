import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const testsRoot = join(process.cwd(), "tests");
const familyRoot = join(testsRoot, "platformServer");
const legacyFile = join(testsRoot, "platformServer.test.ts");
const architectureFile = join(testsRoot, "platformServerArchitecture.test.ts");

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const descendantTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const descendants = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return descendantTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  }));

  return descendants.flat();
};

const familyFiles = async (): Promise<string[]> => {
  const legacyFiles = await exists(legacyFile) ? [legacyFile] : [];
  return [
    architectureFile,
    ...legacyFiles,
    ...await descendantTypeScriptFiles(familyRoot),
  ];
};

const lineCount = (source: string): number => {
  const lines = source.split("\n").length;
  return source.endsWith("\n") ? lines - 1 : lines;
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
      (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) &&
      node.exclamationToken !== undefined
    ) findings.push("definite assignment assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("explicit any");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

const suppressionComments = (source: string): string[] => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  const findings: string[] = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const comment = scanner.getTokenText();
      if (
        /@ts-(?:ignore|expect-error|nocheck)|eslint-disable|prettier-ignore|(?:istanbul|c8) ignore/
          .test(comment)
      ) findings.push(comment);
    }
    token = scanner.scan();
  }
  return findings;
};

describe("platform server test architecture", () => {
  it("keeps the family focused and free of unsafe TypeScript escapes", async () => {
    const files = await familyFiles();
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(lineCount(source), file).toBeLessThanOrEqual(250);
      expect(forbiddenSyntax(file, source), file).toEqual([]);
      expect(suppressionComments(source), file).toEqual([]);
    }
  });
});
