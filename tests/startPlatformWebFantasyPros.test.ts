import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryFantasyProsRepository } from "../src/platform/fantasyPros.js";
import { InMemoryPlayerNewsRepository } from "../src/platform/playerNews.js";
import { readPlatformRuntimeConfig } from "../src/platform/platformRuntimeConfig.js";
import { startFantasyProsRefreshIfConfigured } from "../src/platform/startPlatformWeb/fantasyProsRefresh.js";
import { fantasyProsClientFor } from "../src/platform/startPlatformWeb/runtimeServices.js";
import { stubReportingFeed } from "./support/reportingFeed.js";

const configFor = (env: NodeJS.ProcessEnv = {}) => readPlatformRuntimeConfig({
  MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
  MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
  ...env,
});

describe("platform web FantasyPros wiring", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

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

  it("still refreshes the keyless news feed when FantasyPros is dark", async () => {
    // RotoWire needs no API key, and the request path no longer fetches, so a
    // deployment without a key must still end up with news to serve.
    stubReportingFeed();
    const repository = new InMemoryFantasyProsRepository();
    const playerNewsRepository = new InMemoryPlayerNewsRepository();

    const loop = startFantasyProsRefreshIfConfigured({
      client: undefined,
      repository,
      playerNewsRepository,
      playerNewsEnabled: true,
    });
    await vi.waitFor(async () =>
      expect(await playerNewsRepository.recentItems()).not.toEqual([]));
    loop?.stop();

    expect((await repository.datasetStatuses()).map(status => status.dataset))
      .toEqual(["news-rotowire", "news-retention"]);
  });

  it("schedules nothing at all when both sources are switched off", () => {
    // An offline end-to-end run reaches no public feed, keyed or not.
    const repository = new InMemoryFantasyProsRepository();

    const loop = startFantasyProsRefreshIfConfigured({
      client: undefined,
      repository,
      playerNewsRepository: new InMemoryPlayerNewsRepository(),
      playerNewsEnabled: false,
    });

    expect(loop).toBeUndefined();
  });

  it("starts a stoppable refresh loop once a client exists", async () => {
    stubReportingFeed();
    const repository = new InMemoryFantasyProsRepository();
    const playerNewsRepository = new InMemoryPlayerNewsRepository();
    const client = {
      fetchRankings: vi.fn(async () => ({
        type: "ros" as const,
        scoring: "PPR" as const,
        week: 0,
        rankings: [],
      })),
      fetchProjections: vi.fn(async () => ({ position: "QB" as const, week: 0, projections: [] })),
      fetchPlayers: vi.fn(async () => []),
      fetchNews: vi.fn(async () => []),
    };

    const loop = startFantasyProsRefreshIfConfigured({
      client,
      repository,
      playerNewsRepository,
      playerNewsEnabled: true,
    });
    await vi.waitFor(async () =>
      expect((await repository.datasetStatuses()).length).toBe(9));
    loop?.stop();

    expect(client.fetchPlayers).toHaveBeenCalledOnce();
    expect(client.fetchNews).toHaveBeenCalledOnce();
  });
});
