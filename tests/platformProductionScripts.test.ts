import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  scripts?: Record<string, string>;
}

describe("platform production scripts", () => {
  it("runs every hosted process from compiled JavaScript without tsx", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest;

    expect(manifest.scripts).toMatchObject({
      start: "node dist/src/platform/startPlatformWeb.js",
      "platform:web": "node dist/src/platform/startPlatformWeb.js",
      "platform:migrate": "node dist/src/platform/runPlatformMigrations.js",
      "platform:ready": "node dist/src/platform/checkPlatformProductionReadiness.js",
      "platform:worker": "node dist/src/platform/startPlatformWorker.js",
    });
  });
});
