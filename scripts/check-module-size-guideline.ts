import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const preferredProductionModuleLines = 150;
const sourceRoots = ["config", "scripts", "src", "web/src"];
const checkedExtensions = new Set([".ts", ".tsx"]);
const testFilePattern = /\.test\.(?:ts|tsx)$/u;

export interface ModuleSizeWarning {
  file: string;
  lines: number;
}

const sourceFilesWithin = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesWithin(path);
    if (!entry.isFile() || !checkedExtensions.has(extname(entry.name))) return [];
    return testFilePattern.test(entry.name) ? [] : [path];
  });

export const physicalLineCount = (source: string): number => {
  if (source.length === 0) return 0;
  const lines = source.split(/\r?\n/u);
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
};

export const moduleSizeWarning = (file: string, lines: number): ModuleSizeWarning | undefined =>
  lines > preferredProductionModuleLines ? { file, lines } : undefined;

export const productionModuleSizeWarnings = (rootDirectory: string): ModuleSizeWarning[] =>
  sourceRoots.flatMap(rootName => {
    const root = join(rootDirectory, rootName);
    if (!existsSync(root)) return [];
    return sourceFilesWithin(root).flatMap(file => {
      const lines = physicalLineCount(readFileSync(file, "utf8"));
      const warning = moduleSizeWarning(relative(rootDirectory, file), lines);
      return warning === undefined ? [] : [warning];
    });
  }).sort((left, right) => left.file.localeCompare(right.file));

const run = (): void => {
  for (const warning of productionModuleSizeWarnings(process.cwd())) {
    console.warn(
      `::warning file=${warning.file},title=Module size guideline::${warning.file} has ${String(warning.lines)} lines; prefer ${String(preferredProductionModuleLines)} or fewer.`,
    );
  }
};

const executablePath = process.argv[1];
if (executablePath !== undefined && import.meta.url === pathToFileURL(executablePath).href) run();
