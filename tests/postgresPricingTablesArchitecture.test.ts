import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import { pricingTables } from "../src/platform/postgresSchema/tables/pricingTables.js";

const expectedTableNames = [
  "model_runs",
  "pricing_snapshots",
  "player_prices",
  "league_season_draft_setups",
];
const tablesRoot = join(process.cwd(), "src/platform/postgresSchema/tables");
const moduleRoot = join(tablesRoot, "pricingTables");

const fingerprint = (value: unknown): string => createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex");

const productionFiles = async (): Promise<string[]> => {
  const entries = await readdir(moduleRoot, { withFileTypes: true }).catch(() => []);
  return [
    join(tablesRoot, "pricingTables.ts"),
    ...entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
      .map(entry => join(moduleRoot, entry.name)),
  ];
};

const forbiddenSyntax = (file: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

const isPricingStatement = (statement: string): boolean => expectedTableNames.some(
  tableName => statement.startsWith(`CREATE TABLE ${tableName} (`)
    || statement.includes(` ON ${tableName} (`),
);

describe("Postgres pricing table architecture", () => {
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

  it("preserves the schema contract and generated SQL fingerprints", () => {
    expect(pricingTables.map(table => table.name)).toEqual(expectedTableNames);
    expect(fingerprint(pricingTables)).toBe(
      "fc3cf3dc8ed67d8ac56515a15e0d3cbc8c22060294592378402196074d303316",
    );

    const statements = platformPostgresMigrationStatements.filter(isPricingStatement);
    expect(statements).toHaveLength(7);
    expect(fingerprint(statements)).toBe(
      "dd5a8f39714a4a8fe565de8fa5e273127414b45d7e77d36767ce281916fc70ec",
    );
  });
});
