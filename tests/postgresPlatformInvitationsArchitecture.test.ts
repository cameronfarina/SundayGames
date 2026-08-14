import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as invitations from "../src/platform/postgresPlatformInvitations.js";

const platformRoot = join(process.cwd(), "src/platform");
const moduleRoot = join(platformRoot, "postgresPlatformInvitations");

const productionFiles = async (): Promise<string[]> => {
  const entries = await readdir(moduleRoot, { withFileTypes: true }).catch(() => []);
  return [
    join(platformRoot, "postgresPlatformInvitations.ts"),
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

describe("Postgres platform invitation repository architecture", () => {
  it("preserves its public runtime surface", () => {
    expect(Object.keys(invitations).sort()).toEqual([
      "PostgresPlatformInvitationRepository",
      "platformInvitationSchemaStatements",
    ]);
  });

  it("uses focused production modules without unsafe type escapes", async () => {
    const files = await productionFiles();
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(150);
      expect(forbiddenSyntax(file, source), file).toEqual([]);
      expect(source, file).not.toMatch(/@ts-(?:ignore|expect-error)|eslint-disable/);
    }
  });
});
