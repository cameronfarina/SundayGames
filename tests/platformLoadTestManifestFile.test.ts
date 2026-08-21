import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validatedLoadManifestPath } from "../scripts/platformLoadTest/manifestFile.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async path => await rm(path, { recursive: true })));
});

describe("platform load manifest file guard", () => {
  it("requires a mode-0600 manifest stored outside the repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "platform-load-manifest-"));
    temporaryDirectories.push(root);
    const repository = join(root, "repository");
    const secrets = join(root, "secrets");
    await Promise.all([mkdir(repository), mkdir(secrets)]);
    const manifest = join(secrets, "platform-load-manifest.json");
    await writeFile(manifest, "{}", { mode: 0o600 });

    await expect(validatedLoadManifestPath(manifest, repository)).resolves.toBe(await realpath(manifest));

    await chmod(manifest, 0o644);
    await expect(validatedLoadManifestPath(manifest, repository)).rejects.toThrow("mode 0600");

    const insideRepository = join(repository, "platform-load-manifest.json");
    await writeFile(insideRepository, "{}", { mode: 0o600 });
    await expect(validatedLoadManifestPath(insideRepository, repository)).rejects.toThrow("outside the repository");
  });
});
