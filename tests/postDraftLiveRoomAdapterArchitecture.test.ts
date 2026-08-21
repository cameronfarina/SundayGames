import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src", "platform");
const moduleRoot = join(sourceRoot, "postDraftLiveRoomAdapter");

const moduleFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return moduleFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  }));
  return nested.flat();
};

const forbiddenNodes = (file: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || node.kind === ts.SyntaxKind.AnyKeyword
    ) {
      findings.push(ts.SyntaxKind[node.kind]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

describe("post-draft live room adapter architecture", () => {
  it("keeps the public facade and implementation modules focused and typed", async () => {
    const files = [
      join(sourceRoot, "postDraftLiveRoomAdapter.ts"),
      ...await moduleFiles(moduleRoot),
    ];
    expect(files.length).toBeGreaterThan(1);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(250);
      expect(forbiddenNodes(file, source), file).toEqual([]);
      expect(source, file).not.toMatch(/@ts-(?:ignore|expect-error)|eslint-disable/);
    }
  });
});
