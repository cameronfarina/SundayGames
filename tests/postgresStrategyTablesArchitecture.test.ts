import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { strategyTables } from "../src/platform/postgresSchema/tables/strategyTables.js";

const tablesRoot = join(process.cwd(), "src/platform/postgresSchema/tables");
const moduleRoot = join(tablesRoot, "strategyTables");

const productionFiles = async (): Promise<string[]> => {
  const entries = await readdir(moduleRoot, { withFileTypes: true }).catch(() => []);
  return [
    join(tablesRoot, "strategyTables.ts"),
    ...entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
      .map(entry => join(moduleRoot, entry.name)),
  ];
};

const forbiddenSyntax = (file: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) findings.push("type assertion");
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

describe("Postgres strategy table architecture", () => {
  it("preserves the public table order", () => {
    expect(strategyTables.map(table => table.name)).toEqual([
      "strategy_plans",
      "strategy_plan_versions",
      "target_lists",
      "target_list_items",
      "private_notes",
    ]);
  });

  it("preserves every strategy table schema contract", () => {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(strategyTables))
      .digest("hex");

    expect(fingerprint).toBe("9cf864d2ad3647e0d2bc7677c9faf0befadf97382cbaad58b473872a0fca2df0");
  });

  it("uses focused production modules without unsafe type escapes", async () => {
    const files = await productionFiles();
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(250);
      expect(forbiddenSyntax(file, source), file).toEqual([]);
      expect(source, file).not.toMatch(/@ts-(?:ignore|expect-error)|eslint-disable/);
    }
  });
});
