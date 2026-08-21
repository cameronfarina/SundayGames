import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { build } from "vite";
import { createWebViteConfig } from "../web/vite.config.js";

let outputDirectory: string | undefined;

afterEach(async () => {
  if (outputDirectory !== undefined) await rm(outputDirectory, { force: true, recursive: true });
});

describe("browser simulation production bundle", () => {
  it("contains the shared engine without a Node external shim", async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), "sundaygames-browser-worker-"));
    const config = createWebViteConfig({
      platformTarget: "http://127.0.0.1:4320",
      root: "web",
      runtimeId: "bundle-test",
      webPort: 4319,
    });
    await build({
      ...config,
      logLevel: "silent",
      build: {
        ...config.build,
        outDir: outputDirectory,
        emptyOutDir: true,
      },
    });
    const assetsDirectory = join(outputDirectory, "assets");
    const workerFile = (await readdir(assetsDirectory))
      .find(file => file.startsWith("seasonSimulation.worker-") && file.endsWith(".js"));
    expect(workerFile).toBeDefined();
    const source = await readFile(join(assetsDirectory, workerFile ?? "missing"), "utf8");

    expect(source).not.toMatch(/__vite-browser-external|node:(?:crypto|fs|path)/);
    expect(source).toContain("season-simulation");
  });
});
