import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as restoreModule from "../scripts/rehearse-postgres-restore.js";

const scriptsRoot = join(process.cwd(), "scripts");
const moduleRoot = join(scriptsRoot, "rehearsePostgresRestore");
const testsRoot = join(process.cwd(), "tests");
const suppressionPattern = new RegExp(
  ["@", "ts-", "(?:ignore|expect-error|nocheck)", "|eslint-", "disable"].join(""),
  "u",
);

const productionFiles = async (): Promise<string[]> => {
  const entries = await readdir(moduleRoot, { withFileTypes: true }).catch(() => []);

  return [
    join(scriptsRoot, "rehearse-postgres-restore.ts"),
    ...entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
      .map(entry => join(moduleRoot, entry.name)),
  ];
};

const focusedTestFiles = async (): Promise<string[]> => {
  const entries = await readdir(testsRoot, { withFileTypes: true });

  return [
    ...entries
      .filter(entry => entry.isFile() &&
        entry.name.startsWith("postgresRestoreRehearsal") &&
        entry.name.endsWith(".test.ts"))
      .map(entry => join(testsRoot, entry.name)),
    join(testsRoot, "postgresRestoreRehearsal/fixtures.ts"),
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

describe("Postgres restore rehearsal architecture", () => {
  it("preserves the restore script runtime exports", () => {
    expect(Object.keys(restoreModule)).toEqual([
      "inspectPostgresDatabase",
      "rehearsePostgresRestore",
      "runPostgresRestoreRehearsalCli",
    ]);
  });

  it("uses focused production modules without unsafe type escapes", async () => {
    const files = await productionFiles();
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(150);
      expect(forbiddenSyntax(file, source), file).toEqual([]);
      expect(source, file).not.toMatch(suppressionPattern);
    }
  });

  it("keeps its focused tests small and free of unsafe type escapes", async () => {
    for (const file of await focusedTestFiles()) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(150);
      expect(forbiddenSyntax(file, source), file).toEqual([]);
      expect(source, file).not.toMatch(suppressionPattern);
    }
  });
});
