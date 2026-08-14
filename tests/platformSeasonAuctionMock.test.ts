import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const expectedBehaviors = [
  "builds arbitrary league teams, roster limits, keepers, and personalized prices",
  "uses canonical hybrid eligibility and excludes IR from mock capacity",
  "caps specialist eligibility at 32 viable roles without promoting near-zero depth",
  "rejects unknown legacy roster slots",
  "replays persisted JSON commands and rejects malformed data",
  "rejects snake seasons and unclaimed teams",
];

const directory = path.resolve("tests/platformSeasonAuctionMock");
const files = readdirSync(directory)
  .filter(file => file.endsWith(".ts"))
  .map(file => path.join(directory, file));
const behaviorFiles = files.filter(file => file.endsWith(".test.ts"));

const metadataFor = (file: string): {
  readonly names: readonly string[];
  readonly assertions: number;
  readonly unsafe: readonly string[];
} => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const names: string[] = [];
  const unsafe: string[] = [];
  let assertions = 0;
  const forbidden: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.AnyKeyword,
    ts.SyntaxKind.AsExpression,
    ts.SyntaxKind.NonNullExpression,
    ts.SyntaxKind.TypeAssertionExpression,
  ]);
  const visit = (node: ts.Node): void => {
    if (forbidden.has(node.kind)) unsafe.push(ts.SyntaxKind[node.kind] ?? "unknown");
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "expect") assertions += 1;
      const title = node.arguments[0];
      if (node.expression.text === "it" && title !== undefined && ts.isStringLiteralLike(title)) {
        names.push(title.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { names, assertions, unsafe };
};

describe("season auction mock test architecture", () => {
  it("preserves season auction mock behaviors and assertions", () => {
    const metadata = behaviorFiles.map(metadataFor);
    expect(metadata.flatMap(item => item.names).sort()).toEqual([...expectedBehaviors].sort());
    expect(metadata.reduce((total, item) => total + item.assertions, 0)).toBe(19);
  });

  it("keeps season auction mock tests focused and free of unsafe type escapes", () => {
    const violations = files.flatMap(file => {
      const lines = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
      const unsafe = metadataFor(file).unsafe.map(finding => `${path.basename(file)}: ${finding}`);
      return lines > 150 ? [`${path.basename(file)}: ${lines} lines`, ...unsafe] : unsafe;
    });
    expect(violations).toEqual([]);
  });
});
