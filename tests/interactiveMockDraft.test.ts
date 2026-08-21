import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const expectedBehaviors = [
  "uses real auction nominations and pauses when Owner11 can enter the bidding",
  "keeps AI sale previews open until the advance action logs the sale",
  "stops for Owner11 when his strategy max beats the AI price",
  "exposes the current auction bid and lets AI continue after Owner11 raises",
  "lets Owner11 explicitly nominate a selected player on his snake turn",
  "uses the selected owner in user-facing auction errors",
];

const testDirectory = path.resolve("tests/interactiveMockDraft");
const files = readdirSync(testDirectory)
  .filter(file => file.endsWith(".ts"))
  .map(file => path.join(testDirectory, file));
const behaviorFiles = files.filter(file => file.endsWith(".test.ts"));

const sourceFileFor = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

const metadataFor = (sourceFile: ts.SourceFile): {
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

describe("interactive mock draft test architecture", () => {
  it("preserves interactive mock behavior names and assertions", () => {
    const metadata = behaviorFiles.map(sourceFileFor).map(metadataFor);
    const behaviorNames = metadata.flatMap(item => item.behaviorNames).sort();
    const assertions = metadata.reduce((total, item) => total + item.assertionCount, 0);
    expect(behaviorNames).toEqual([...expectedBehaviors].sort());
    expect(assertions).toBe(45);
  });

  it("keeps interactive mock tests focused and free of unsafe type escapes", () => {
    const violations = files.flatMap(file => {
      const lines = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
      const unsafe = metadataFor(sourceFileFor(file)).unsafeSyntax
        .map(finding => `${path.basename(file)}: ${finding}`);
      return lines > 250 ? [`${path.basename(file)}: ${lines} lines`, ...unsafe] : unsafe;
    });
    expect(violations).toEqual([]);
  });
});
