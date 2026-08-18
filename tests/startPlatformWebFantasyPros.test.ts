import { describe, expect, it, vi } from "vitest";
import { InMemoryFantasyProsRepository } from "../src/platform/fantasyPros.js";
import { readPlatformRuntimeConfig } from "../src/platform/platformRuntimeConfig.js";
import { startFantasyProsRefreshIfConfigured } from "../src/platform/startPlatformWeb/fantasyProsRefresh.js";
import { fantasyProsClientFor } from "../src/platform/startPlatformWeb/runtimeServices.js";

const configFor = (env: NodeJS.ProcessEnv = {}) => readPlatformRuntimeConfig({
  MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
  MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
  ...env,
});

describe("platform web FantasyPros wiring", () => {
  it("builds no client without an API key", () => {
    expect(fantasyProsClientFor(configFor())).toBeUndefined();
  });

  it("builds a client once the API key is configured", () => {
    expect(fantasyProsClientFor(configFor({ FANTASYPROS_API_KEY: "test-key" })))
      .toBeDefined();
  });

  it("honours the explicit refresh opt-out even with a key present", () => {
    expect(fantasyProsClientFor(configFor({
      FANTASYPROS_API_KEY: "test-key",
      MOCKD_FANTASYPROS_REFRESH_ENABLED: "false",
    }))).toBeUndefined();
  });

  it("starts no refresh loop when the feature is dark", () => {
    const repository = new InMemoryFantasyProsRepository();
    const claimRefresh = vi.spyOn(repository, "claimRefresh");

    const loop = startFantasyProsRefreshIfConfigured({ client: undefined, repository });

    expect(loop).toBeUndefined();
    expect(claimRefresh).not.toHaveBeenCalled();
  });

  it("starts a stoppable refresh loop once a client exists", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const client = {
      fetchRankings: vi.fn(async () => ({
        type: "ros" as const,
        scoring: "PPR" as const,
        week: 0,
        rankings: [],
      })),
      fetchProjections: vi.fn(async () => ({ position: "QB" as const, week: 0, projections: [] })),
      fetchPlayers: vi.fn(async () => []),
    };

    const loop = startFantasyProsRefreshIfConfigured({ client, repository });
    await vi.waitFor(async () =>
      expect((await repository.datasetStatuses()).length).toBe(6));
    loop?.stop();

    expect(client.fetchPlayers).toHaveBeenCalledOnce();
  });
});
