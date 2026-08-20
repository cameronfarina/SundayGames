import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { platformLoadCliConfigFrom } from "./platformLoadTest/cliConfig.js";
import { platformLoadManifestFrom } from "./platformLoadTest/parseManifest.js";
import { validatedLoadManifestPath } from "./platformLoadTest/manifestFile.js";
import { runPlatformLoadTest } from "./platformLoadTest/runner.js";
import { platformLoadTargetFor } from "./platformLoadTest/target.js";

export const runPlatformLoadCli = async (
  args: readonly string[] = process.argv.slice(2),
): Promise<number> => {
  const config = platformLoadCliConfigFrom(args);
  const target = platformLoadTargetFor(config.target, config.allowRemote);
  const manifestPath = await validatedLoadManifestPath(config.manifestPath);
  const manifestValue: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  const manifest = platformLoadManifestFrom(manifestValue);
  const report = await runPlatformLoadTest({
    baseUrl: target.baseUrl,
    holdMs: config.holdMs,
    leagueCount: config.leagueCount,
    manifest,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.passed ? 0 : 1;
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPlatformLoadCli().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : "Platform load test failed."}\n`);
    process.exitCode = 1;
  });
}
