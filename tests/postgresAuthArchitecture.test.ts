import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as postgresAuth from "../src/platform/postgresAuth.js";

const sourceDirectory = dirname(fileURLToPath(
  new URL("../src/platform/postgresAuth.ts", import.meta.url),
));

const productionFiles = (): string[] => {
  const files = [join(sourceDirectory, "postgresAuth.ts")];
  const subtree = join(sourceDirectory, "postgresAuth");
  if (!statSync(subtree, { throwIfNoEntry: false })?.isDirectory()) return files;

  for (const entry of readdirSync(subtree, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(join(subtree, entry.name));
  }
  return files;
};

const forbiddenSyntax = (sourceFile: ts.SourceFile): string[] => {
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

describe("Postgres auth repository architecture", () => {
  it("preserves its public runtime surface", () => {
    expect(Object.keys(postgresAuth).sort()).toEqual(["PostgresAuthRepository"]);
  });

  it("keeps focused production modules free of unsafe type escape hatches", () => {
    for (const file of productionFiles()) {
      const source = readFileSync(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(150);
      const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      expect(forbiddenSyntax(syntax), file).toEqual([]);
    }
  });
});
