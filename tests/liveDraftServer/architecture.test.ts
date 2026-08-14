import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const testsRoot = join(process.cwd(), "tests");
const familyRoot = join(testsRoot, "liveDraftServer");
const entryFile = join(testsRoot, "liveDraftServer.test.ts");
const architectureFile = join(familyRoot, "architecture.test.ts");
const expectedBehaviorNames: readonly string[] = [
  "accepts build-around mock scripts and runs each price point as a forced Owner11 start",
  "accepts scripted mock targets and applies Owner11 max-bid caps to the batch job",
  "applies a real AI mock sale before returning the next nomination",
  "evicts completed mock jobs by count and age",
  "exports a complete one-click draft session bundle",
  "keeps all-source player news useful when the optional remote provider fails",
  "keeps named live, practice, and scratch sessions in separate file stores",
  "keeps real draft actions, interactive practice actions, and bulk mocks in distinct modes",
  "locks live draft-night sessions against interactive mock advances",
  "previews Owner11-selected mock nominations before appending the sale command",
  "protects the live room from unconfirmed or stale undo, reset, and import actions",
  "publishes interactive mock completion as a viewable one-run results job",
  "publishes mock results from the active interactive session instead of the latest batch",
  "rejects a declared oversized API body without waiting for the body",
  "rejects ambiguous scripted mock player names before starting a batch job",
  "rejects chunked API bodies as soon as the streamed bytes exceed the limit",
  "rejects disabled legacy mock batches before reading or allocating work",
  "rejects obsolete browser routes while keeping draft APIs available",
  "rejects unique scratch sessions before allocating production resources",
  "returns Retry-After when shared mock capacity is exhausted",
  "returns a compact import conflict review without replacing the session",
  "returns an empty latest mock batch response before a batch has run",
  "returns complete optimized 14-team mock result payloads",
  "scopes latest mock results and direct job access by owner and draft session",
  "scopes post-draft mock ranges to the matching batch strategy",
  "serializes live sale validation so duplicate concurrent purchases cannot both write",
  "serves read-only league sync provider readiness and setup-gated Yahoo OAuth",
  "serves read-only My Expert advice from the active Mockd roster API",
  "serves strategy-aware state and advances interactive mock actions through persisted commands",
  "serves the draft board with the same default sourced evidence as prep commands",
  "serves the local evidence-backed player news API",
  "uses the larger configured body limit only for draft imports",
  "uses the request owner for interactive mock state",
  "runs interactive mock speed controls through persisted sale commands",
  "returns an updated mock auction when AI keeps bidding after Owner11 raises",
];

const descendantTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const descendants = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return descendantTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  }));

  return descendants.flat();
};

const familyFiles = async (): Promise<string[]> => [
  entryFile,
  ...await descendantTypeScriptFiles(familyRoot),
];

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
      if (/@ts-(?:ignore|expect-error|nocheck)/.test(comment)) findings.push(comment);
    }
    token = scanner.scan();
  }
  return findings;
};

const behaviorNames = (file: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "it"
    ) {
      const name = node.arguments[0];
      if (name && ts.isStringLiteral(name)) names.push(name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
};

describe("live draft server test architecture", () => {
  it("keeps the test family focused and free of unsafe TypeScript escapes", async () => {
    const files = await familyFiles();
    expect(files).toContain(architectureFile);
    const actualBehaviorNames: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(lineCount(source), file).toBeLessThanOrEqual(250);
      expect(forbiddenSyntax(file, source), file).toEqual([]);
      expect(suppressionComments(source), file).toEqual([]);
      if (file !== architectureFile) actualBehaviorNames.push(...behaviorNames(file, source));
    }

    expect(actualBehaviorNames.sort()).toEqual([...expectedBehaviorNames].sort());
  });
});
