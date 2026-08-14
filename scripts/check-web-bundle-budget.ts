import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { z } from "zod";

const kibibyte = 1_024;
const entryBudgetBytes = 130 * kibibyte;
const lazyBudgetBytes = 75 * kibibyte;
const stylesheetBudgetBytes = 30 * kibibyte;

const manifestEntrySchema = z.object({
  css: z.array(z.string()).optional(),
  file: z.string(),
  isDynamicEntry: z.boolean().optional(),
  isEntry: z.boolean().optional(),
});
const manifestSchema = z.record(z.string(), manifestEntrySchema);

interface BudgetedAsset {
  readonly file: string;
  readonly maximumBytes: number;
}

const compressedBytesFor = async (directory: string, file: string): Promise<number> =>
  gzipSync(await readFile(join(directory, file))).byteLength;

const budgetedAssetsFor = (manifest: z.output<typeof manifestSchema>): readonly BudgetedAsset[] => {
  const assets = new Map<string, number>();
  for (const entry of Object.values(manifest)) {
    if (entry.isEntry === true) assets.set(entry.file, entryBudgetBytes);
    if (entry.isDynamicEntry === true) assets.set(entry.file, lazyBudgetBytes);
    for (const stylesheet of entry.css ?? []) {
      assets.set(stylesheet, stylesheetBudgetBytes);
    }
  }

  return [...assets].map(([file, maximumBytes]) => ({ file, maximumBytes }));
};

export const webBundleBudgetViolations = async (
  directory = "dist/web",
): Promise<readonly string[]> => {
  const manifestText = await readFile(join(directory, ".vite", "manifest.json"), "utf8");
  const manifestData: unknown = JSON.parse(manifestText);
  const manifest = manifestSchema.parse(manifestData);
  const results = await Promise.all(budgetedAssetsFor(manifest).map(async asset => ({
    ...asset,
    compressedBytes: await compressedBytesFor(directory, asset.file),
  })));

  return results
    .filter(result => result.compressedBytes > result.maximumBytes)
    .map(result => `${result.file} is ${result.compressedBytes} gzip bytes; maximum is ${result.maximumBytes}.`);
};

const run = async (): Promise<void> => {
  const violations = await webBundleBudgetViolations();
  for (const violation of violations) console.error(violation);
  if (violations.length > 0) process.exitCode = 1;
};

const executablePath = process.argv[1];
if (executablePath !== undefined && import.meta.url === pathToFileURL(executablePath).href) {
  void run();
}
