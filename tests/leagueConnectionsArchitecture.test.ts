import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const maximumLines = 250;

const moduleRoots: readonly string[] = [
  "src/data/leagueSyncProviderAdapters",
  "src/platform/leagueConnections",
  "src/platform/leagueSyncService",
  "src/platform/postgresLeagueConnections",
  "src/platform/http/routes/leagueConnections",
];

const facades: readonly string[] = [
  "src/data/leagueSyncProviderAdapters.ts",
  "src/platform/leagueConnections.ts",
  "src/platform/leagueSyncService.ts",
  "src/platform/postgresLeagueConnections.ts",
];

const productionFiles = (): readonly string[] => [
  ...facades.map(file => join(process.cwd(), file)),
  ...moduleRoots.flatMap(root => {
    const directory = join(process.cwd(), root);
    return readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
      .map(entry => join(directory, entry.name));
  }),
];

const unsafeSyntaxIn = (file: string): readonly string[] => {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      findings.push("type assertion");
    }
    if (ts.isNonNullExpression(node)) findings.push("non-null assertion");
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push("any keyword");
    ts.forEachChild(node, visit);
  };
  visit(source);

  const comments = text.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu) ?? [];
  if (comments.some(comment => /@ts-(?:ignore|expect-error|nocheck)|eslint-disable/u.test(comment))) {
    findings.push("suppression comment");
  }
  return findings;
};

describe("league connections architecture", () => {
  it("keeps every production module focused and strictly typed", () => {
    for (const file of productionFiles()) {
      const label = file.replace(`${process.cwd()}/`, "");
      expect(readFileSync(file, "utf8").split("\n").length, label)
        .toBeLessThanOrEqual(maximumLines);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });

  it("keeps the provider adapters free of platform imports", () => {
    const adapters = productionFiles()
      .filter(file => file.includes("leagueSyncProviderAdapters"));

    for (const file of adapters) {
      expect(readFileSync(file, "utf8"), file).not.toContain("../platform/");
    }
  });
});
