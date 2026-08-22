import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readArtifact = async (path: string): Promise<string> => await readFile(path, "utf8");

describe("production container artifacts", () => {
  it("separates compilation, production dependencies, and the runtime image", async () => {
    const dockerfile = await readArtifact("Dockerfile");

    expect(dockerfile).toMatch(/^FROM node:24\.19\.0-bookworm-slim AS build$/m);
    expect(dockerfile).toMatch(/^FROM node:24\.19\.0-bookworm-slim AS production-dependencies$/m);
    expect(dockerfile).toMatch(/^FROM node:24\.19\.0-bookworm-slim AS runtime$/m);
    expect(dockerfile).toMatch(/^RUN npm ci --omit=dev$/m);
    expect(dockerfile).toContain(
      "COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules",
    );

    const runtimeStage = dockerfile.slice(dockerfile.indexOf("AS runtime"));
    expect(runtimeStage).not.toMatch(/\bnpm (?:ci|install)\b/);
    expect(runtimeStage).toContain(
      "COPY --from=build --chown=node:node /app/dist/src ./dist/src",
    );
    expect(runtimeStage).toContain(
      "COPY --from=build --chown=node:node /app/dist/config ./dist/config",
    );
    expect(dockerfile).toContain("COPY web ./web");
    expect(dockerfile).toContain("COPY browser-extension ./browser-extension");
    expect(dockerfile).toContain(
      "COPY scripts/build-browser-extension.ts ./scripts/build-browser-extension.ts",
    );
    expect(runtimeStage).toContain(
      "COPY --from=build --chown=node:node /app/dist/web ./dist/web",
    );
    expect(runtimeStage).not.toContain("COPY --chown=node:node data/raw ./data/raw");
    expect(runtimeStage).toContain(
      "COPY --chown=node:node data/raw/espn-projections-2026-weeks-1-4.json ./data/raw/espn-projections-2026-weeks-1-4.json",
    );
    expect(runtimeStage).toContain(
      "COPY --chown=node:node data/raw/player-evidence-2026-initial.csv ./data/raw/player-evidence-2026-initial.csv",
    );
    expect(runtimeStage).toContain(
      "COPY --chown=node:node data/raw/season-long-projections-2026.json ./data/raw/season-long-projections-2026.json",
    );
    expect(runtimeStage).toContain(
      "COPY --chown=node:node data/raw/fantasy-draft-rankings-2026 ./data/raw/fantasy-draft-rankings-2026",
    );
  });

  it("runs as a non-root user with writable container-local draft storage", async () => {
    const dockerfile = await readArtifact("Dockerfile");

    expect(dockerfile).toContain(
      "RUN install -d -o node -g node /var/lib/mockd/draft-tools",
    );
    expect(dockerfile).toContain(
      "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools",
    );
    // Declaring a volume invites re-attaching a Render disk, which would cost
    // zero-downtime deploys; the image creates the directory instead.
    expect(dockerfile).not.toContain("VOLUME");
    expect(dockerfile).toMatch(/^USER node$/m);
  });

  it("delivers termination signals directly to the graceful Node entrypoint", async () => {
    const dockerfile = await readArtifact("Dockerfile");

    expect(dockerfile).toMatch(/^STOPSIGNAL SIGTERM$/m);
    expect(dockerfile).toContain(
      'CMD ["/bin/sh", "-c", "node dist/src/platform/checkPlatformProductionReadiness.js && exec node dist/src/platform/startPlatformWeb.js"]',
    );
    expect(dockerfile).not.toMatch(/^CMD npm /m);
  });

  it("delegates HTTP readiness to the web service because the image also runs workers", async () => {
    const dockerfile = await readArtifact("Dockerfile");
    const renderBlueprint = await readArtifact("render.yaml");

    expect(dockerfile).not.toMatch(/^HEALTHCHECK /m);
    expect(renderBlueprint).toContain("healthCheckPath: /readyz");
  });

  it("keeps local artifacts and secrets out of the build context", async () => {
    const patterns = new Set(
      (await readArtifact(".dockerignore"))
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith("#")),
    );
    const requiredPatterns = [
      ".git",
      ".env",
      ".env.*",
      "node_modules",
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      "*.log",
      "output",
      ".mockd",
      "data/private",
      "data/fixtures",
      "data/raw/*-board.csv",
      "data/processed",
    ];

    expect(requiredPatterns.filter(pattern => !patterns.has(pattern))).toEqual([]);
  });
});
