import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  FantasyProsRequestError,
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
  fantasyProsRetryDelayMs,
  fantasyProsThrottleNotice,
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
  fetchNews: async () => [],
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
      fetchNews: async request => {
        requests += 1;
        return await inner.fetchNews(request);
      },
    },
  };
};

const entriesFor = (client: FantasyProsClient, repository: InMemoryFantasyProsRepository) =>
  fantasyProsDatasetRefreshes({ client, repository });

const now = new Date("2026-09-10T12:00:00.000Z");

describe("FantasyPros refresh gating", () => {
  it("refreshes every dataset on the first pass and stores what it fetched", async () => {
    const repository = new InMemoryFantasyProsRepository();

    const client = fixtureClient();
    const results = await refreshFantasyProsDatasets(
      { repository, now: () => now },
      entriesFor(client, repository),
    );

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

    const entries = entriesFor(client, repository);
    await refreshFantasyProsDatasets({ repository, now: () => now }, entries);
    const firstPassRequests = requests();
    const results = await refreshFantasyProsDatasets(
      { repository, now: () => new Date(now.getTime() + 60_000) },
      entries,
    );

    expect(results.map(result => result.status)).toEqual(Array(6).fill("skipped"));
    expect(requests()).toBe(firstPassRequests);
  });

  it("refreshes rankings and projections on their own cadence before the catalog", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const entries = entriesFor(fixtureClient(), repository);
    await refreshFantasyProsDatasets({ repository, now: () => now }, entries);

    const results = await refreshFantasyProsDatasets(
      { repository, now: () => new Date(now.getTime() + fantasyProsRankingsCadenceMs) },
      entries,
    );

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

    await refreshFantasyProsDatasets(
      { repository, now: () => now },
      entriesFor(first.client, repository),
    );
    await refreshFantasyProsDatasets(
      { repository, now: () => now },
      entriesFor(second.client, repository),
    );

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

    const results = await refreshFantasyProsDatasets(
      { repository, now: () => now, onError },
      entriesFor(failing, repository),
    );

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

    const entries = entriesFor(client, repository);
    await refreshFantasyProsDatasets({ repository, now: () => now }, entries);
    await refreshFantasyProsDatasets(
      { repository, now: () => new Date(now.getTime() + 60_000) },
      entries,
    );

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

    await refreshFantasyProsDatasets(
      { repository, now: () => now },
      entriesFor(client, repository),
    );

    const weeks = fetchProjections.mock.calls.map(([request]) => request.week);
    expect(new Set(weeks)).toEqual(new Set([0, 7]));
  });

  it("keeps five good positions when one projection request fails", async () => {
    // The production defect: a single failing position threw out of the loop,
    // so projections-ros stored zero rows even though five positions answered.
    const repository = new InMemoryFantasyProsRepository();
    const inner = fixtureClient();
    const client: FantasyProsClient = {
      ...inner,
      fetchProjections: async request => {
        if (request.position === "QB") throw new Error("QB projections unavailable");
        return await inner.fetchProjections(request);
      },
    };

    const results = await refreshFantasyProsDatasets(
      { repository, now: () => now },
      entriesFor(client, repository),
    );

    const restOfSeason = results.find(result => result.dataset === "projections-ros");
    expect(restOfSeason?.status).toBe("partial");
    expect(restOfSeason?.rowCount).toBeGreaterThan(0);
    await expect(repository.projections({ week: 0 })).resolves.not.toEqual([]);
    const status = (await repository.datasetStatuses())
      .find(entry => entry.dataset === "projections-ros");
    expect(status?.lastError).toContain("QB: QB projections unavailable");
    expect(status?.rowCount).toBeGreaterThan(0);
  });

  it("reports a dataset as failed only when nothing landed", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const client: FantasyProsClient = {
      ...fixtureClient(),
      fetchProjections: async () => { throw new Error("upstream down"); },
    };

    const results = await refreshFantasyProsDatasets(
      { repository, now: () => now },
      entriesFor(client, repository),
    );

    expect(results.find(result => result.dataset === "projections-ros")?.status).toBe("failed");
    expect(results.find(result => result.dataset === "players")?.status).toBe("refreshed");
  });

  it("retries a failed dataset well before its full cadence", async () => {
    // A transient failure used to cost six hours of staleness because the
    // claim had already moved the stored timestamp forward.
    const repository = new InMemoryFantasyProsRepository();
    const fetchPlayers = vi.fn(async () => { throw new Error("upstream down"); });
    const client: FantasyProsClient = { ...fixtureClient(), fetchPlayers };

    const entries = entriesFor(client, repository);
    await refreshFantasyProsDatasets({ repository, now: () => now }, entries);
    await refreshFantasyProsDatasets(
      { repository, now: () => new Date(now.getTime() + fantasyProsRetryDelayMs - 1) },
      entries,
    );
    expect(fetchPlayers).toHaveBeenCalledOnce();

    await refreshFantasyProsDatasets(
      { repository, now: () => new Date(now.getTime() + fantasyProsRetryDelayMs) },
      entries,
    );
    expect(fetchPlayers).toHaveBeenCalledTimes(2);
    expect(fantasyProsRetryDelayMs).toBeLessThan(fantasyProsPlayersCadenceMs);
  });

  it("keeps the scheduled request budget well under the daily quota", () => {
    const entries = entriesFor(fixtureClient(), new InMemoryFantasyProsRepository());
    const perCycle = entries.reduce((total, entry) => total + entry.requestCount, 0);
    const perDay = entries.reduce(
      (total, entry) => total + entry.requestCount * Math.round(24 * 60 * 60 * 1000 / entry.cadenceMs),
      0,
    );

    // Every dataset due at once: 3 rankings + 12 projections + 1 catalog.
    expect(perCycle).toBe(16);
    expect(perDay).toBe(fantasyProsDailyRequestBudget);
    expect(perDay).toBeLessThan(100);
  });
});

describe("FantasyPros refresh when the API refuses on rate", () => {
  const throttled = (): FantasyProsClient => ({
    ...fixtureClient(),
    fetchPlayers: async () => { throw new FantasyProsRequestError("/nfl/players", 429); },
  });

  const claimableAfter = async (
    client: FantasyProsClient,
    elapsedMs: number,
  ): Promise<boolean> => {
    const repository = new InMemoryFantasyProsRepository();
    await refreshFantasyProsDatasets({ repository, now: () => now }, entriesFor(client, repository));

    const results = await refreshFantasyProsDatasets(
      { repository, now: () => new Date(now.getTime() + elapsedMs) },
      entriesFor(fixtureClient(), repository),
    );
    return results.find(result => result.dataset === "players")?.status !== "skipped";
  };

  it("makes a throttled dataset wait its whole cadence instead of retrying in half an hour", async () => {
    // The defect: the 30 minute rewind treats a 429 like a transient blip, so
    // a throttled dataset spends the quota that caused the throttle all day.
    await expect(claimableAfter(throttled(), fantasyProsRetryDelayMs)).resolves.toBe(false);
    await expect(claimableAfter(throttled(), fantasyProsPlayersCadenceMs)).resolves.toBe(true);
  });

  it("still retries an ordinary failure on the short delay", async () => {
    const outage: FantasyProsClient = {
      ...fixtureClient(),
      fetchPlayers: async () => { throw new FantasyProsRequestError("/nfl/players", 500); },
    };

    await expect(claimableAfter(outage, fantasyProsRetryDelayMs)).resolves.toBe(true);
  });

  it("says out loud that it is throttled rather than just failing", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await refreshFantasyProsDatasets(
      { repository, now: () => now },
      entriesFor(throttled(), repository),
    );

    const status = (await repository.datasetStatuses())
      .find(entry => entry.dataset === "players");
    expect(status?.lastError).toContain(fantasyProsThrottleNotice);
    expect(status?.lastError).toContain("failed with 429");
  });

  it("carries the throttle out of the projections loop, which stringifies its errors", async () => {
    // Projections catch per position, so the thrown error never reaches the
    // refresh; without the flag on the run result the signal would be lost.
    const inner = fixtureClient();
    const repository = new InMemoryFantasyProsRepository();
    const client: FantasyProsClient = {
      ...inner,
      fetchProjections: async request => {
        if (request.position === "QB") throw new FantasyProsRequestError("/projections", 429);
        return await inner.fetchProjections(request);
      },
    };

    await refreshFantasyProsDatasets({ repository, now: () => now }, entriesFor(client, repository));
    const results = await refreshFantasyProsDatasets(
      { repository, now: () => new Date(now.getTime() + fantasyProsRetryDelayMs) },
      entriesFor(fixtureClient(), repository),
    );

    expect(results.find(result => result.dataset === "projections-ros")?.status).toBe("skipped");
    const status = (await repository.datasetStatuses())
      .find(entry => entry.dataset === "projections-ros");
    expect(status?.lastError).toContain(fantasyProsThrottleNotice);
  });

  it("treats an untyped error mentioning 429 as an ordinary failure", async () => {
    // Only a status the client actually read counts. Text that happens to say
    // 429 is not evidence FantasyPros refused on rate.
    const lookalike: FantasyProsClient = {
      ...fixtureClient(),
      fetchPlayers: async () => { throw new Error("upstream said 429 somewhere"); },
    };

    await expect(claimableAfter(lookalike, fantasyProsRetryDelayMs)).resolves.toBe(true);
  });
});
