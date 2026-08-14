import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const roots = [
  "src/platform/platformStoreSnapshotCodec.ts",
  "src/platform/platformStoreSnapshotCodec",
  "src/platform/filePlatformStore.ts",
  "src/platform/filePlatformStore",
  "tests/platformStoreSnapshotCodec.test.ts",
  "tests/platformStoreSnapshotCodecVariants.test.ts",
  "tests/platformStoreSnapshotValidation.test.ts",
  "tests/platformFilePlatformStore.test.ts",
  "tests/platformStoreSnapshotFixtures",
];

const sourceFiles = (path: string): string[] => {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap(name => sourceFiles(join(path, name)));
};

const unsafeNodes = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node) || node.kind === ts.SyntaxKind.AnyKeyword) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      findings.push(`${file}:${line}:${ts.SyntaxKind[node.kind]}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

describe("platform store persistence architecture", () => {
  it("keeps production modules focused", () => {
    const productionFiles = roots.slice(0, 4).flatMap(sourceFiles);
    const oversized = productionFiles.flatMap(file => {
      const lines = readFileSync(file, "utf8").split("\n").length;
      return lines > 150 ? [`${file}:${lines}`] : [];
    });
    expect(oversized).toEqual([]);
  });

  it("uses no unsafe type escape hatches", () => {
    const files = roots.flatMap(sourceFiles).filter(file => file.endsWith(".ts"));
    const suppressions = files.flatMap(file => /@ts-(?:ignore|expect-error)/.test(readFileSync(file, "utf8"))
      ? [`${file}:suppression`]
      : []);
    expect([...files.flatMap(unsafeNodes), ...suppressions]).toEqual([]);
  });
});
