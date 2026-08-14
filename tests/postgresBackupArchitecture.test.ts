import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..");
const scriptsDirectory = join(repositoryRoot, "scripts");
const preferredMaximumLines = 150;

const backupProductionFiles = async (): Promise<string[]> => {
  const scriptFiles = await readdir(scriptsDirectory, { recursive: true });

  return scriptFiles
    .filter(file => file === "backup-postgres.ts" || file.startsWith(`postgres-backup${sep}`))
    .filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map(file => join(scriptsDirectory, file))
    .sort();
};

const physicalLineCount = (source: string): number => {
  if (source.length === 0) return 0;

  const lines = source.split(/\r?\n/);
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
};

const typeEscapeViolations = (path: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      violations.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) violations.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) violations.push("explicit any");
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (/@ts-(?:ignore|expect-error|nocheck)|eslint-disable|biome-ignore/u.test(source)) {
    violations.push("suppression directive");
  }

  return violations;
};

describe("Postgres backup architecture", () => {
  it("keeps every production module within the preferred line limit", async () => {
    for (const path of await backupProductionFiles()) {
      const source = await readFile(path, "utf8");
      expect(
        physicalLineCount(source),
        relative(repositoryRoot, path),
      ).toBeLessThanOrEqual(preferredMaximumLines);
    }
  });

  it("uses no TypeScript type escape hatches", async () => {
    for (const path of await backupProductionFiles()) {
      const source = await readFile(path, "utf8");
      expect(
        typeEscapeViolations(path, source),
        relative(repositoryRoot, path),
      ).toEqual([]);
    }
  });
});
