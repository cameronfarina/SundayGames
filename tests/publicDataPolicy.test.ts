import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditPublicData } from "../scripts/publicDataPolicy.js";

const approvedDockerInputs = [
  "data/raw/espn-projections-2026-weeks-1-4.json",
  "data/raw/player-evidence-2026-initial.csv",
  "data/raw/season-long-projections-2026.json",
  "data/raw/fantasy-draft-rankings-2026",
].map(path => `COPY --chown=node:node ${path} /approved`).join("\n");

describe("public data policy", () => {
  it("keeps private league sources out of the repository and production image inputs", async () => {
    await expect(auditPublicData(process.cwd())).resolves.toEqual([]);
  });

  it("rejects known owner identifiers and private source filenames", async () => {
    const root = await mkdtemp(join(tmpdir(), "mockd-public-data-policy-"));

    try {
      await mkdir(join(root, "data/fixtures/historical"), { recursive: true });
      await mkdir(join(root, "data/raw"), { recursive: true });
      await writeFile(join(root, "Dockerfile"), approvedDockerInputs);
      await writeFile(
        join(root, ".gitignore"),
        ".mockd/private-source-data/\ndata/private/\n",
      );
      await writeFile(
        join(root, "data/fixtures/historical/unsafe.csv"),
        "Team,Private Test Owner\n",
      );
      await writeFile(join(root, "data/raw/2023-board.csv"), "private");

      await expect(auditPublicData(root)).resolves.toEqual(expect.arrayContaining([
        "Historical fixture data/fixtures/historical/unsafe.csv contains a protected owner identifier.",
        "Private data path is present: data/raw/2023-board.csv",
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects non-synthetic league configuration from source and compiled image inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "mockd-public-config-policy-"));

    try {
      await mkdir(join(root, "src"), { recursive: true });
      await mkdir(join(root, "config"), { recursive: true });
      await mkdir(join(root, "dist/config"), { recursive: true });
      await writeFile(join(root, "Dockerfile"), approvedDockerInputs);
      await writeFile(
        join(root, ".gitignore"),
        ".mockd/private-source-data/\ndata/private/\n",
      );
      await writeFile(
        join(root, "src/localDemoFixtures.ts"),
        'export const email = "private-owner@mockd.local";\n',
      );
      await writeFile(
        join(root, "config/keepers.ts"),
        'export const keepers = [{ owner: "PrivateOwner", player: "Private Player" }];\n',
      );
      await writeFile(join(root, "dist/config/league.js"), "export const leagueId = 999999;\n");

      await expect(auditPublicData(root)).resolves.toEqual(expect.arrayContaining([
        "Production input src/localDemoFixtures.ts contains non-synthetic local account email.",
        "Production input config/keepers.ts contains non-synthetic keeper owner.",
        "Production input config/keepers.ts contains non-synthetic keeper fixture.",
        "Production input dist/config/league.js contains non-synthetic external league identifier.",
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
