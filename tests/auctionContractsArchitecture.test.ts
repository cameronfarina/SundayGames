import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const contractDirectory = path.resolve("src/modeling/auctionEngine/auctionContracts");
const facade = path.resolve("src/modeling/auctionEngine/auctionContracts.ts");
const architectureTest = path.resolve("tests/auctionContractsArchitecture.test.ts");

const publicContractNames = [
  "AuctionBid",
  "AuctionBidDiagnostics",
  "AuctionBidDriver",
  "AuctionBidDriverDirection",
  "AuctionBudgetTrajectoryEvent",
  "AuctionBudgetTrajectoryRow",
  "AuctionNominationCandidateDiagnostics",
  "AuctionNominationDiagnostics",
  "AuctionNominationScoreComponents",
  "AuctionOwnerState",
  "AuctionPick",
  "AuctionPickDiagnostics",
  "AuctionResult",
  "AuctionRoomPressureDiagnostics",
  "AuctionRosters",
  "AuctionSale",
  "AuctionSalePriceBasis",
  "ResolveAuctionSaleOptions",
  "SimulateAuctionOptions",
];

const namedExportsFrom = (file: string): readonly string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

  return source.statements.flatMap(statement => {
    if (!ts.isExportDeclaration(statement)) return [];
    if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return [];
    return statement.exportClause.elements.map(element => element.name.text);
  });
};

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
  if (comments.some(comment => /@ts-(?:ignore|expect-error|nocheck)/u.test(comment))) {
    findings.push("TypeScript suppression");
  }
  return findings;
};

describe("auction contract architecture", () => {
  it("preserves the public API through a type-only facade", () => {
    const source = ts.createSourceFile(
      facade,
      readFileSync(facade, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );

    expect(source.statements.every(ts.isExportDeclaration)).toBe(true);
    expect([...namedExportsFrom(facade)].sort()).toEqual(publicContractNames);
  });

  it("keeps cohesive contract modules focused and strictly typed", () => {
    expect(existsSync(contractDirectory)).toBe(true);
    if (!existsSync(contractDirectory)) return;

    const files = [
      facade,
      ...readdirSync(contractDirectory)
        .filter(name => name.endsWith(".ts"))
        .map(name => path.join(contractDirectory, name)),
      architectureTest,
    ];

    for (const file of files) {
      const label = path.relative(process.cwd(), file);
      expect(readFileSync(file, "utf8").split("\n").length, label).toBeLessThanOrEqual(250);
      expect(unsafeSyntaxIn(file), label).toEqual([]);
    }
  });
});
