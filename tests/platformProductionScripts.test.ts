import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const packageManifestSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
});

describe("platform production scripts", () => {
  it("runs every hosted process from compiled JavaScript without tsx", async () => {
    const manifest = packageManifestSchema.parse(JSON.parse(
      await readFile("package.json", "utf8"),
    ));

    expect(manifest.scripts).toMatchObject({
      start: "node dist/src/platform/startPlatformWeb.js",
      "platform:web": "node dist/src/platform/startPlatformWeb.js",
      "platform:migrate": "node dist/src/platform/runPlatformMigrations.js",
      "platform:ready": "node dist/src/platform/checkPlatformProductionReadiness.js",
      "platform:worker": "node dist/src/platform/startPlatformWorker.js",
    });
  });
});
