import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as leagueSync from "../src/modeling/leagueSync.js";

const facade = path.resolve("src/modeling/leagueSync.ts");
const directory = path.resolve("src/modeling/leagueSync");

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

describe("league sync architecture", () => {
  it("preserves the public runtime surface", () => {
    expect(Object.keys(leagueSync).sort()).toEqual([
      "leagueSyncProviderStatuses",
      "leagueSyncReadOnlyPolicy",
      "yahooAuthorizationEndpoint",
      "yahooFantasyReadScope",
      "yahooOAuthAuthorizeUrl",
      "yahooTokenEndpoint",
    ]);
  });

  it("uses focused modules without TypeScript escape hatches", () => {
    expect(existsSync(directory)).toBe(true);
    if (!existsSync(directory)) return;

    const files = [
      facade,
      ...readdirSync(directory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(directory, name)),
      path.resolve("tests/leagueSync.test.ts"),
      path.resolve("tests/leagueSyncArchitecture.test.ts"),
    ];

    for (const file of files) {
      const label = path.relative(process.cwd(), file);
      expect(readFileSync(file, "utf8").split("\n").length, label).toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
