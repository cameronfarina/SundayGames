import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { privateConfigurationViolations } from "./privateConfigurationPolicy.js";

const privateDataPaths = [
  "data/raw/2023-board.csv",
  "data/raw/2024-board.csv",
  "data/raw/2025-board.csv",
  "data/processed/current-keepers.json",
  "data/processed/fantasy_owner_behavior_rules_v1.xlsx",
];

const productionDataInputs = [
  "data/raw/espn-projections-2026-weeks-1-4.json",
  "data/raw/player-evidence-2026-initial.csv",
  "data/raw/season-long-projections-2026.json",
  "data/raw/fantasy-draft-rankings-2026",
];

const requiredIgnoreRules = [
  ".mockd/private-source-data/",
  "data/private/",
];

const productionCodeDirectories = [
  "config",
  "src",
  "dist/config",
  "dist/src",
];

const fileExists = async (path: string): Promise<boolean> => {
  try {
    const entry = await stat(path);
    return entry.isFile() || entry.isDirectory();
  } catch {
    return false;
  }
};

const filesBelow = async (directory: string): Promise<string[]> => {
  if (!(await fileExists(directory))) return [];

  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return nested.flat();
};

const syntheticOwnerPattern = /^Owner\d{2}$/;

const ownerLabels = (filePath: string, content: string): string[] => {
  if (extname(filePath) === ".csv") {
    const header = content.split(/\r?\n/, 1)[0] ?? "";
    return header.split(",").slice(1).map(value => value.trim()).filter(Boolean);
  }

  if (extname(filePath) === ".json") {
    return [...content.matchAll(/"owner"\s*:\s*"([^"]+)"/g)]
      .flatMap(match => match[1] ? [match[1]] : []);
  }

  return [];
};

const containsProtectedOwner = (filePath: string, content: string): boolean =>
  ownerLabels(filePath, content).some(owner => !syntheticOwnerPattern.test(owner));

const dockerInputLine = (source: string): RegExp =>
  new RegExp(`^COPY(?:\\s+--[^\\s]+)*\\s+${source.replaceAll("/", "\\/")}(?:\\s|$)`, "m");

export const auditPublicData = async (root: string): Promise<string[]> => {
  const violations: string[] = [];

  for (const path of privateDataPaths) {
    if (await fileExists(join(root, path))) violations.push(`Private data path is present: ${path}`);
  }

  const fixtureDirectory = join(root, "data/fixtures/historical");
  for (const path of await filesBelow(fixtureDirectory)) {
    const content = await readFile(path, "utf8");
    if (containsProtectedOwner(path, content)) {
      violations.push(`Historical fixture ${relative(root, path)} contains a protected owner identifier.`);
    }
  }

  for (const directory of productionCodeDirectories) {
    for (const path of await filesBelow(join(root, directory))) {
      const content = await readFile(path, "utf8");
      for (const label of privateConfigurationViolations(path, content)) {
        violations.push(`Production input ${relative(root, path)} contains ${label}.`);
      }
    }
  }

  const dockerfile = await readFile(join(root, "Dockerfile"), "utf8");
  if (/^COPY(?:\s+--[^\s]+)*\s+data\/(?:raw|processed)\s/m.test(dockerfile)) {
    violations.push("Dockerfile copies an entire raw or processed data directory.");
  }
  for (const path of privateDataPaths) {
    if (dockerfile.includes(path)) violations.push(`Dockerfile references private data path ${path}.`);
  }
  for (const path of productionDataInputs) {
    if (!dockerInputLine(path).test(dockerfile)) {
      violations.push(`Dockerfile does not explicitly copy approved public input ${path}.`);
    }
  }

  const gitignore = await readFile(join(root, ".gitignore"), "utf8");
  for (const rule of requiredIgnoreRules) {
    if (!gitignore.split("\n").includes(rule)) violations.push(`.gitignore is missing ${rule}`);
  }

  return violations.sort();
};
