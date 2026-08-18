import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const moduleRoots = [
  "src/data/fantasyPros",
  "src/platform/fantasyPros",
  "src/platform/fantasyProsMatching",
  "src/platform/fantasyProsRefresh",
  "src/platform/postgresFantasyPros",
];

const facades = [
  "src/data/fantasyPros.ts",
  "src/platform/fantasyPros.ts",
  "src/platform/fantasyProsMatching.ts",
  "src/platform/fantasyProsRefresh.ts",
  "src/platform/postgresFantasyPros.ts",
  "src/platform/http/routes/fantasyProsStatus.ts",
  "src/platform/postgresSchema/tables/fantasyProsTables.ts",
  "src/platform/startPlatformWeb/fantasyProsRefresh.ts",
];

const productionFiles = (): readonly string[] => [
  ...facades.map(file => path.resolve(file)),
  ...moduleRoots.flatMap(root => readdirSync(path.resolve(root), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
    .map(entry => path.resolve(root, entry.name))),
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
  if (/@ts-(?:ignore|expect-error|nocheck)/u.test(text)) {
    findings.push("TypeScript suppression comment");
  }
  return findings;
};

describe("FantasyPros architecture", () => {
  it("keeps every production module focused and strictly typed", () => {
    const files = productionFiles();

    expect(files.length).toBeGreaterThan(facades.length);
    for (const file of files) {
      const label = path.relative(process.cwd(), file);
      const source = readFileSync(file, "utf8");
      expect(source.trimEnd().split("\n").length, label).toBeLessThanOrEqual(150);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });

  it("keeps the FantasyPros API key out of every shipped module", () => {
    for (const file of productionFiles()) {
      const label = path.relative(process.cwd(), file);
      const source = readFileSync(file, "utf8");
      expect(source, label).not.toMatch(/FANTASYPROS_API_KEY\s*=\s*["'][^"']/u);
    }
  });

  it("keeps FantasyPros data out of the pricing and simulation engines", () => {
    // FantasyPros numbers are advisory display only; the draft pricing engine
    // stays FantasyPros-free so removing the integration leaves it whole.
    const pricingRoots = ["src/modeling", "src/platform/seasonAuctionMock", "src/platform/seasonMockResults"];
    const offenders: string[] = [];

    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(target);
        else if (entry.isFile() && entry.name.endsWith(".ts") &&
          /fantasyPros|fantasypros/u.test(readFileSync(target, "utf8"))) {
          offenders.push(path.relative(process.cwd(), target));
        }
      }
    };
    for (const root of pricingRoots) walk(path.resolve(root));

    expect(offenders).toEqual([]);
  });
});
