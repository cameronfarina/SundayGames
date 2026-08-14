import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { featureCycleViolations } from "../web/scripts/frontendFeatureCycles.js";
import { importBoundaryViolations } from "../web/scripts/frontendImportBoundaries.js";
import {
  syntaxQualityViolations,
  type FrontendQualityViolation,
} from "../web/scripts/frontendQualitySyntax.js";
import { missingColocatedTestViolations } from "../web/scripts/frontendTestCoverage.js";
import type { FrontendSourceModule } from "../web/scripts/frontendQualityTypes.js";

export type { FrontendQualityViolation } from "../web/scripts/frontendQualitySyntax.js";

export const frontendMaximumLines = 250;
export const frontendPreferredLines = 150;
const checkedExtensions = new Set([".css", ".ts", ".tsx"]);

export interface FrontendArchitectureViolation {
  file: string;
  lines: number;
}

export const frontendLineCount = (content: string): number => {
  if (content.length === 0) return 0;
  const lines = content.split(/\r?\n/u);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
};

const sourceFilesWithin = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesWithin(path);
    return checkedExtensions.has(extname(entry.name)) ? [path] : [];
  }));

  return nestedFiles.flat();
};

export const frontendQualityViolations = async (
  rootDirectory: string,
): Promise<FrontendQualityViolation[]> => {
  const files = (await sourceFilesWithin(join(rootDirectory, "web", "src")))
    .filter(file => [".ts", ".tsx"].includes(extname(file)))
    .sort();
  const modules: FrontendSourceModule[] = await Promise.all(files.map(async file => {
    const content = await readFile(file, "utf8");
    return { content, file, relativeFile: relative(rootDirectory, file) };
  }));
  const violations = modules.flatMap(module => {
    return [
      ...syntaxQualityViolations(module.file, module.relativeFile, module.content),
      ...importBoundaryViolations(module.file, module.relativeFile, module.content),
    ].sort((left, right) => left.line - right.line);
  });
  return [
    ...violations,
    ...featureCycleViolations(modules),
    ...missingColocatedTestViolations(files.map(file => relative(rootDirectory, file))),
  ].sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
};

export const frontendArchitectureViolations = async (
  rootDirectory: string,
): Promise<FrontendArchitectureViolation[]> => {
  const files = await sourceFilesWithin(join(rootDirectory, "web"));
  const violations = await Promise.all(files.map(async (file) => {
    const content = await readFile(file, "utf8");
    const lines = frontendLineCount(content);
    return lines > frontendMaximumLines
      ? { file: relative(rootDirectory, file), lines }
      : undefined;
  }));

  return violations.filter((violation) => violation !== undefined);
};

export const frontendArchitectureWarnings = async (
  rootDirectory: string,
): Promise<FrontendArchitectureViolation[]> => {
  const files = await sourceFilesWithin(join(rootDirectory, "web"));
  const warnings = await Promise.all(files.map(async file => {
    const lines = frontendLineCount(await readFile(file, "utf8"));
    return lines > frontendPreferredLines && lines <= frontendMaximumLines
      ? { file: relative(rootDirectory, file), lines }
      : undefined;
  }));

  return warnings.filter(warning => warning !== undefined);
};

const run = async (): Promise<void> => {
  const warnings = await frontendArchitectureWarnings(process.cwd());
  const violations = await frontendArchitectureViolations(process.cwd());
  const qualityViolations = await frontendQualityViolations(process.cwd());
  for (const warning of warnings) {
    console.warn(
      `${warning.file} has ${String(warning.lines)} lines; prefer ${String(frontendPreferredLines)} or fewer.`,
    );
  }
  if (violations.length === 0 && qualityViolations.length === 0) return;

  for (const violation of violations) {
    console.error(
      `${violation.file} has ${String(violation.lines)} lines; maximum is ${String(frontendMaximumLines)}.`,
    );
  }
  for (const violation of qualityViolations) {
    console.error(`${violation.file}:${String(violation.line)} [${violation.rule}] ${violation.detail}`);
  }
  process.exitCode = 1;
};

const executablePath = process.argv[1];
if (executablePath !== undefined && import.meta.url === pathToFileURL(executablePath).href) {
  void run();
}
