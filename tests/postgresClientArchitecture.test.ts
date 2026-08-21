import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as postgresClient from "../src/platform/postgresClient.js";

const platformDirectory = dirname(fileURLToPath(
  new URL("../src/platform/postgresClient.ts", import.meta.url),
));
const testDirectory = dirname(fileURLToPath(import.meta.url));

const typescriptFilesIn = (directory: string): string[] => {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFilesIn(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
};

const ownedFiles = (): string[] => [
  join(platformDirectory, "postgresClient.ts"),
  ...typescriptFilesIn(join(platformDirectory, "postgresClient")),
  join(testDirectory, "postgresClient.test.ts"),
  join(testDirectory, "postgresClientArchitecture.test.ts"),
  join(testDirectory, "postgresClientFactory.test.ts"),
];

const forbiddenSyntax = (sourceFile: ts.SourceFile): string[] => {
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

const suppressionsIn = (source: string): string[] => {
  const prefix = ["@ts", "-"].join("");
  return ["ignore", "expect-error", "nocheck"].filter(directive =>
    source.includes(`${prefix}${directive}`));
};

describe("Postgres client architecture", () => {
  it("preserves its public runtime surface", () => {
    expect(Object.keys(postgresClient).sort()).toEqual([
      "NodePostgresClient",
      "createNodePostgresClient",
    ]);
  });

  it("keeps owned files focused and free of unsafe type escape hatches", () => {
    for (const file of ownedFiles()) {
      const source = readFileSync(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(250);
      const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      expect([...forbiddenSyntax(syntax), ...suppressionsIn(source)], file).toEqual([]);
    }
  });
});
