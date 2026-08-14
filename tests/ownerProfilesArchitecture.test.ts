import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as ownerProfiles from "../src/modeling/ownerProfiles.js";

const modelingRoot = join(process.cwd(), "src/modeling");
const moduleRoot = join(modelingRoot, "ownerProfiles");

const productionFiles = async (): Promise<string[]> => {
  const entries = await readdir(moduleRoot, { withFileTypes: true }).catch(() => []);
  return [
    join(modelingRoot, "ownerProfiles.ts"),
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

describe("owner profiles architecture", () => {
  it("preserves the public runtime surface", () => {
    expect(Object.keys(ownerProfiles).sort()).toEqual([
      "buildLeagueOpenAuctionSpendTargets",
      "buildOwnerProfiles",
      "defaultHistoricalWeights",
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
