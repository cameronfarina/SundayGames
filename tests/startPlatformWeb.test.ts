import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const expectedBehaviors = [
  "emits a sanitized structured error when process startup fails",
  "reports unready when Postgres is required but its client is unavailable",
  "closes Postgres when server startup fails",
  "fails closed when only local file storage is configured by default",
  "starts an explicit local-fixture preview with file-backed storage",
  "forwards the provisioning token while public signup remains closed",
  "provides local live-draft setup data only in local-fixture mode",
];

const testDirectory = path.resolve("tests/startPlatformWeb");
const files = readdirSync(testDirectory)
  .filter(file => file.endsWith(".ts"))
  .map(file => path.join(testDirectory, file));
const behaviorFiles = files.filter(file => file.endsWith(".test.ts"));

const sourceFileFor = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

const testMetadata = (sourceFile: ts.SourceFile): {
  readonly behaviorNames: readonly string[];
  readonly assertionCount: number;
  readonly unsafeSyntax: readonly string[];
} => {
  const behaviorNames: string[] = [];
  const unsafeSyntax: string[] = [];
  let assertionCount = 0;
  const forbidden: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.AnyKeyword,
    ts.SyntaxKind.AsExpression,
    ts.SyntaxKind.NonNullExpression,
    ts.SyntaxKind.TypeAssertionExpression,
  ]);
  const visit = (node: ts.Node): void => {
    if (forbidden.has(node.kind)) unsafeSyntax.push(ts.SyntaxKind[node.kind] ?? "unknown");
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "expect") assertionCount += 1;
      const name = node.arguments[0];
      if (node.expression.text === "it" && name !== undefined && ts.isStringLiteralLike(name)) {
        behaviorNames.push(name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { behaviorNames, assertionCount, unsafeSyntax };
};

describe("platform web startup test architecture", () => {
  it("preserves startup behavior names and assertions", () => {
    const metadata = behaviorFiles.map(sourceFileFor).map(testMetadata);
    const behaviorNames = metadata.flatMap(item => item.behaviorNames).sort();
    const assertionCount = metadata.reduce((total, item) => total + item.assertionCount, 0);
    expect(behaviorNames).toEqual([...expectedBehaviors].sort());
    expect(assertionCount).toBe(16);
  });

  it("keeps startup tests focused and free of unsafe type escapes", () => {
    const violations = files.flatMap(file => {
      const lines = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
      const unsafe = testMetadata(sourceFileFor(file)).unsafeSyntax
        .map(finding => `${path.basename(file)}: ${finding}`);
      return lines > 150 ? [`${path.basename(file)}: ${lines} lines`, ...unsafe] : unsafe;
    });
    expect(violations).toEqual([]);
  });
});
