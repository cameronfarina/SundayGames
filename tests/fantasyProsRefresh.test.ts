import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseFantasyProsPlayers,
  parseFantasyProsProjections,
  parseFantasyProsRankings,
  type FantasyProsClient,
} from "../src/data/fantasyPros.js";
import { InMemoryFantasyProsRepository } from "../src/platform/fantasyPros.js";
import {
  fantasyProsDailyRequestBudget,
  fantasyProsDatasetRefreshes,
  fantasyProsPlayersCadenceMs,
  fantasyProsRankingsCadenceMs,
  refreshFantasyProsDatasets,
} from "../src/platform/fantasyProsRefresh.js";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/fantasyPros", name), "utf8"));

const fixtureClient = (): FantasyProsClient => ({
  fetchRankings: async ({ type }) => parseFantasyProsRankings(
    fixture(type === "weekly" ? "rankings-weekly.json" : "rankings-ros.json"),
    { type, scoring: "PPR", week: type === "weekly" ? 1 : 0 },
  ),
  fetchProjections: async ({ position, week }) => parseFantasyProsProjections(
    fixture(week === 0 ? "projections-ros-rb.json" : "projections-qb-week1.json"),
    { position, week },
  ),
  fetchPlayers: async () => parseFantasyProsPlayers(fixture("players.json")),
});

const countingClient = (): { client: FantasyProsClient; requests: () => number } => {
  const inner = fixtureClient();
  let requests = 0;
  return {
    requests: () => requests,
    client: {
      fetchRankings: async request => {
        requests += 1;
        return await inner.fetchRankings(request);
      },
      fetchProjections: async request => {
        requests += 1;
        return await inner.fetchProjections(request);
      },
      fetchPlayers: async () => {
        requests += 1;
        return await inner.fetchPlayers();
      },
    },
  };
};

const now = new Date("2026-09-10T12:00:00.000Z");

describe("FantasyPros refresh gating", () => {
  it("refreshes every dataset on the first pass and stores what it fetched", async () => {
    const repository = new InMemoryFantasyProsRepository();

    const results = await refreshFantasyProsDatasets({
      client: fixtureClient(),
      repository,
      now: () => now,
    });

    expect(results.map(result => result.status)).toEqual(Array(6).fill("refreshed"));
    await expect(repository.rankings({ rankingType: "ros" }))
      .resolves.not.toEqual([]);
    await expect(repository.players()).resolves.not.toEqual([]);
    const statuses = await repository.datasetStatuses();
    expect(statuses.every(status => status.lastSucceededAt === now.toISOString())).toBe(true);
  });

  it("skips every dataset on a second pass inside the cadence window", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const { client, requests } = countingClient();

    await refreshFantasyProsDatasets({ client, repository, now: () => now });
    const firstPassRequests = requests();
    const results = await refreshFantasyProsDatasets({
      client,
      repository,
      now: () => new Date(now.getTime() + 60_000),
    });

    expect(results.map(result => result.status)).toEqual(Array(6).fill("skipped"));
    expect(requests()).toBe(firstPassRequests);
  });

  it("refreshes rankings and projections on their own cadence before the catalog", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const client = fixtureClient();
    await refreshFantasyProsDatasets({ client, repository, now: () => now });

    const results = await refreshFantasyProsDatasets({
      client,
      repository,
      now: () => new Date(now.getTime() + fantasyProsRankingsCadenceMs),
    });

    const statusByDataset = new Map(results.map(result => [result.dataset, result.status]));
    expect(statusByDataset.get("rankings-weekly")).toBe("refreshed");
    expect(statusByDataset.get("projections-ros")).toBe("refreshed");
    expect(statusByDataset.get("players")).toBe("skipped");
    expect(fantasyProsPlayersCadenceMs).toBeGreaterThan(fantasyProsRankingsCadenceMs);
  });

  it("lets a second instance claim nothing while the first one is inside the window", async () => {
    // Overlapping instances during a zero-downtime deploy share the store, so
    // the claim, not the process, decides who fetches.
    const repository = new InMemoryFantasyProsRepository();
    const first = countingClient();
    const second = countingClient();

    await refreshFantasyProsDatasets({ client: first.client, repository, now: () => now });
    await refreshFantasyProsDatasets({ client: second.client, repository, now: () => now });

    expect(first.requests()).toBeGreaterThan(0);
    expect(second.requests()).toBe(0);
  });

  it("records a failing dataset without stopping the rest of the pass", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const client = fixtureClient();
    const onError = vi.fn();
    const failing: FantasyProsClient = {
      ...client,
      fetchPlayers: async () => { throw new Error("FantasyPros request to /nfl/players failed with 500."); },
    };

    const results = await refreshFantasyProsDatasets({
      client: failing,
      repository,
      now: () => now,
      onError,
    });

    expect(results.find(result => result.dataset === "players")?.status).toBe("failed");
    expect(results.filter(result => result.status === "refreshed").length).toBe(5);
    expect(onError).toHaveBeenCalledOnce();
    const players = await repository.datasetStatuses();
    expect(players.find(status => status.dataset === "players")).toMatchObject({
      lastError: "FantasyPros request to /nfl/players failed with 500.",
      lastSucceededAt: undefined,
    });
  });

  it("does not retry a failed dataset until its cadence has passed", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const fetchPlayers = vi.fn(async () => { throw new Error("upstream down"); });
    const client: FantasyProsClient = { ...fixtureClient(), fetchPlayers };

    await refreshFantasyProsDatasets({ client, repository, now: () => now });
    await refreshFantasyProsDatasets({
      client,
      repository,
      now: () => new Date(now.getTime() + 60_000),
    });

    expect(fetchPlayers).toHaveBeenCalledOnce();
  });

  it("follows the week FantasyPros reports for weekly projections", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const fetchProjections = vi.fn(fixtureClient().fetchProjections);
    const client: FantasyProsClient = {
      ...fixtureClient(),
      fetchRankings: async ({ type }) => ({
        type,
        scoring: "PPR",
        week: type === "weekly" ? 7 : 0,
        rankings: [{ playerId: 1, playerName: "First Player", position: "RB", rankEcr: 1 }],
      }),
      fetchProjections,
    };

    await refreshFantasyProsDatasets({ client, repository, now: () => now });

    const weeks = fetchProjections.mock.calls.map(([request]) => request.week);
    expect(new Set(weeks)).toEqual(new Set([0, 7]));
  });

  it("keeps the scheduled request budget well under the daily quota", () => {
    const perCycle = fantasyProsDatasetRefreshes
      .reduce((total, entry) => total + entry.requestCount, 0);
    const perDay = fantasyProsDatasetRefreshes.reduce(
      (total, entry) => total + entry.requestCount * Math.round(24 * 60 * 60 * 1000 / entry.cadenceMs),
      0,
    );

    // Every dataset due at once: 3 rankings + 12 projections + 1 catalog.
    expect(perCycle).toBe(16);
    expect(perDay).toBe(fantasyProsDailyRequestBudget);
    expect(perDay).toBeLessThan(100);
  });
});
