import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const expectedBehaviors = [
  "hashes normalized inputs stably regardless of object key insertion order",
  "generates the same model run id for the same league season model version and input hash",
  "creates a snapshot that preserves distinct market scenario live personal and max prices",
  "refuses to overwrite an existing model run id with a different payload",
  "stores multiple scenario snapshots for the same model run",
  "returns only the latest matching snapshot without cloning older large snapshots",
  "creates strategy overlays with derived personal values without mutating market prices",
];

const directory = path.resolve("tests/platformPricingSnapshots");
const files = readdirSync(directory)
  .filter(file => file.endsWith(".ts"))
  .map(file => path.join(directory, file));
const behaviorFiles = files.filter(file => file.endsWith(".test.ts"));

const metadataFor = (file: string) => {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
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

describe("pricing snapshot test architecture", () => {
  it("preserves pricing snapshot behaviors and assertions", () => {
    const metadata = behaviorFiles.map(metadataFor);
    expect(metadata.flatMap(item => item.names).sort()).toEqual([...expectedBehaviors].sort());
    expect(metadata.reduce((total, item) => total + item.assertions, 0)).toBe(14);
  });

  it("keeps pricing snapshot tests focused and free of unsafe type escapes", () => {
    const violations = files.flatMap(file => {
      const lines = readFileSync(file, "utf8").trimEnd().split(/\r?\n/u).length;
      const unsafe = metadataFor(file).unsafe.map(finding => `${path.basename(file)}: ${finding}`);
      return lines > 250 ? [`${path.basename(file)}: ${lines} lines`, ...unsafe] : unsafe;
    });
    expect(violations).toEqual([]);
  });
});
