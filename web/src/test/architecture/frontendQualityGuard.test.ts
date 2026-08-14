import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FrontendQualityRule } from "../../../scripts/frontendQualityTypes.js";
import { frontendTestExemptions } from "../../../scripts/frontendTestExemptions.js";
import { frontendQualityViolations } from "../../../../scripts/frontend-architecture-guard.js";

const violationsForRule = async (root: string, rule: FrontendQualityRule) => (
  (await frontendQualityViolations(root)).filter(violation => violation.rule === rule)
);

const sourceDirectory = async (area: string): Promise<{ directory: string; root: string }> => {
  const root = await mkdtemp(join(tmpdir(), "mockd-frontend-guard-"));
  const directory = join(root, "web", "src", area);
  await mkdir(directory, { recursive: true });
  return { directory, root };
};

describe("frontend quality guard", () => {
  it("rejects type escape hatches without rejecting import aliases", async () => {
    const fixture = await sourceDirectory("features/practice");
    await writeFile(join(fixture.directory, "unsafe.ts"), [
      'import { source as renamed } from "./source";',
      "const asserted = source as string;",
      "const untyped: any = renamed;",
      "const forced = asserted!;",
    ].join("\n"));
    await expect(violationsForRule(fixture.root, "type-escape")).resolves.toHaveLength(3);
  });

  it("rejects compiler and linter suppression comments", async () => {
    const fixture = await sourceDirectory("shared");
    await writeFile(join(fixture.directory, "suppressed.ts"), [
      "// @ts-expect-error testing an escape hatch",
      "export const value = 1;",
      "// eslint-disable-next-line no-console",
    ].join("\n"));
    await expect(violationsForRule(fixture.root, "suppression")).resolves.toEqual([
      expect.objectContaining({ line: 1 }),
      expect.objectContaining({ line: 3 }),
    ]);
  });

  it("ignores directive-like text inside string literals", async () => {
    const fixture = await sourceDirectory("shared");
    await writeFile(join(fixture.directory, "message.ts"), [
      'export const compilerText = "@ts-expect-error";',
      'export const linterText = "eslint-disable-next-line";',
    ].join("\n"));
    await expect(violationsForRule(fixture.root, "suppression")).resolves.toEqual([]);
  });

  it("allows network access only inside typed API modules", async () => {
    const fixture = await sourceDirectory("features/practice");
    await mkdir(join(fixture.directory, "api"));
    await mkdir(join(fixture.directory, "components/api"), { recursive: true });
    await writeFile(join(fixture.directory, "api/practiceApi.ts"), "fetch('/catalog');");
    await writeFile(join(fixture.directory, "PracticePage.tsx"), "fetch('/catalog');");
    await writeFile(join(fixture.directory, "components/api/Shortcut.ts"), "fetch('/catalog');");
    await expect(violationsForRule(fixture.root, "direct-fetch")).resolves.toEqual([
      expect.objectContaining({ file: "web/src/features/practice/components/api/Shortcut.ts" }),
      expect.objectContaining({ file: "web/src/features/practice/PracticePage.tsx" }),
    ]);
  });

  it("allows native selects only inside the shared Select primitive", async () => {
    const root = await mkdtemp(join(tmpdir(), "mockd-frontend-guard-"));
    const select = join(root, "web/src/shared/ui/Select");
    const league = join(root, "web/src/features/league");
    await Promise.all([mkdir(select, { recursive: true }), mkdir(league, { recursive: true })]);
    const source = "export const Choice = () => <select />;";
    await writeFile(join(select, "Select.tsx"), source);
    await writeFile(join(league, "Choice.tsx"), source);
    await expect(violationsForRule(root, "native-select")).resolves.toEqual([
      expect.objectContaining({ file: "web/src/features/league/Choice.tsx" }),
    ]);
  });

  it("reserves main landmarks for application layouts", async () => {
    const fixture = await sourceDirectory("features/league");
    await writeFile(join(fixture.directory, "LeaguePage.tsx"), "export const Page = () => <main />;");
    await expect(violationsForRule(fixture.root, "feature-main")).resolves.toHaveLength(1);
  });

  it("enforces one-way app, feature, and shared module boundaries", async () => {
    const fixture = await sourceDirectory("features/league");
    const sharedDirectory = join(fixture.root, "web/src/shared");
    await mkdir(sharedDirectory, { recursive: true });
    await writeFile(join(fixture.directory, "crossFeature.ts"), 'import "../auth/api";');
    await writeFile(join(fixture.directory, "needsApp.ts"), 'import "../../app/router";');
    await writeFile(join(fixture.directory, "usesShared.ts"), 'import "../../shared/ui";');
    await writeFile(join(sharedDirectory, "cycle.ts"), 'import "../features/league/page";');
    await expect(violationsForRule(fixture.root, "layer-import")).resolves.toHaveLength(2);
  });

  it("allows an acyclic dependency between features", async () => {
    const fixture = await sourceDirectory("features/createLeague");
    await writeFile(join(fixture.directory, "schema.ts"), 'import "../league/api/schema";');
    await expect(violationsForRule(fixture.root, "layer-import")).resolves.toEqual([]);
  });

  it("rejects cyclic dependencies between features", async () => {
    const fixture = await sourceDirectory("features/league");
    const authDirectory = join(fixture.root, "web/src/features/auth");
    await mkdir(authDirectory, { recursive: true });
    await writeFile(join(fixture.directory, "leagueApi.ts"), 'import "../auth/authApi";');
    await writeFile(join(authDirectory, "authApi.ts"), 'import "../league/leagueApi";');
    const violations = await violationsForRule(fixture.root, "layer-import");
    expect(violations).toHaveLength(2);
    expect(violations[0]?.detail).toBe("Cross-feature imports cannot create dependency cycles.");
  });

  it("requires a colocated test or a documented module exemption", async () => {
    const fixture = await sourceDirectory("features/practice");
    await writeFile(join(fixture.directory, "Tested.ts"), "export const tested = true;");
    await writeFile(join(fixture.directory, "Tested.test.ts"), "export const covered = true;");
    await writeFile(join(fixture.directory, "Untested.ts"), "export const untested = true;");
    await writeFile(join(fixture.directory, "Helper.testUtils.ts"), "export const helper = true;");
    await expect(violationsForRule(fixture.root, "missing-test")).resolves.toEqual([
      expect.objectContaining({ file: "web/src/features/practice/Untested.ts" }),
    ]);
  });

  it("keeps every test exemption explicit, unique, and documented", () => {
    const uniqueFiles = new Set(frontendTestExemptions.map(exemption => exemption.file));
    expect(uniqueFiles.size).toBe(frontendTestExemptions.length);
    expect(frontendTestExemptions.every(exemption => exemption.reason.trim().length > 0)).toBe(true);
  });
});
