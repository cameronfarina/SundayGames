import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as pricingSnapshots from "../src/platform/pricingSnapshots.js";

const platformRoot = join(process.cwd(), "src/platform");
const moduleRoot = join(platformRoot, "pricingSnapshots");

const productionFiles = async (): Promise<string[]> => {
  const entries = await readdir(moduleRoot, { withFileTypes: true }).catch(() => []);
  return [
    join(platformRoot, "pricingSnapshots.ts"),
    ...entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
      .map(entry => join(moduleRoot, entry.name)),
  ];
};

const forbiddenSyntax = (file: string, source: string): string[] => {
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  return findings;
};

describe("pricing snapshot architecture", () => {
  it("preserves the public runtime surface", () => {
    expect(Object.keys(pricingSnapshots).sort()).toEqual([
      "PricingSnapshotError",
      "applyStrategyOverlay",
      "assertPricingSnapshotCanBeSaved",
      "createInMemoryPricingSnapshotRepository",
      "createPricingInputSnapshot",
      "createPricingSnapshot",
      "generatePricingModelRunId",
      "hashPricingSnapshotInputs",
    ]);
  });

  it("uses focused production modules without TypeScript escape hatches", async () => {
    const files = await productionFiles();
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(150);
      expect(forbiddenSyntax(file, source), file).toEqual([]);
      expect(source, file).not.toMatch(/@ts-(?:ignore|expect-error)|eslint-disable/);
    }
  });
});
