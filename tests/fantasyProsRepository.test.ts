import { describe, expect, it } from "vitest";
import { InMemoryFantasyProsRepository } from "../src/platform/fantasyPros.js";

const fetchedAt = "2026-09-10T12:00:00.000Z";

const savedRankings = async (
  repository: InMemoryFantasyProsRepository,
): Promise<void> => {
  await repository.saveRankings({
    rankingType: "ros",
    scoring: "PPR",
    week: 0,
    fetchedAt,
    rankings: [
      { playerId: 2, playerName: "Second Player", position: "WR", rankEcr: 2, teamAbbreviation: "SF" },
      { playerId: 1, playerName: "First Player", position: "RB", rankEcr: 1, teamAbbreviation: "DET" },
    ],
  });
};

describe("in-memory FantasyPros repository", () => {
  it("stores rankings by type and returns them in consensus order", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await savedRankings(repository);

    const rankings = await repository.rankings({ rankingType: "ros" });

    expect(rankings.map(ranking => ranking.playerName))
      .toEqual(["First Player", "Second Player"]);
    expect(rankings[0]).toMatchObject({ rankingType: "ros", scoring: "PPR", week: 0, fetchedAt });
    await expect(repository.rankings({ rankingType: "weekly" })).resolves.toEqual([]);
  });

  it("replaces a stored ranking when the same player is fetched again", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await savedRankings(repository);
    await repository.saveRankings({
      rankingType: "ros",
      scoring: "PPR",
      week: 0,
      fetchedAt: "2026-09-10T18:00:00.000Z",
      rankings: [{ playerId: 1, playerName: "First Player", position: "RB", rankEcr: 3 }],
    });

    const rankings = await repository.rankings({ rankingType: "ros" });

    expect(rankings.length).toBe(2);
    expect(rankings.find(ranking => ranking.playerId === 1))
      .toMatchObject({ rankEcr: 3, fetchedAt: "2026-09-10T18:00:00.000Z" });
  });

  it("keeps weekly and rest-of-season projections apart", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await repository.saveProjections({
      week: 0,
      position: "RB",
      fetchedAt,
      projections: [{ playerId: 1, playerName: "First Player", position: "RB", pointsPpr: 300 }],
    });
    await repository.saveProjections({
      week: 2,
      position: "RB",
      fetchedAt,
      projections: [{ playerId: 1, playerName: "First Player", position: "RB", pointsPpr: 18 }],
    });

    await expect(repository.projections({ week: 0 }))
      .resolves.toMatchObject([{ pointsPpr: 300 }]);
    await expect(repository.projections({ week: 2 }))
      .resolves.toMatchObject([{ pointsPpr: 18 }]);
    await expect(repository.projections({ week: 2, position: "WR" })).resolves.toEqual([]);
  });

  it("stores the player catalog keyed by FantasyPros id", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await repository.savePlayers({
      fetchedAt,
      players: [
        { playerId: 8120, playerName: "Houston Texans", position: "DST", positions: ["DST"], teamAbbreviation: "HOU" },
        { playerId: 8120, playerName: "Houston Texans", position: "DST", positions: ["DST"], teamAbbreviation: "HOU" },
      ],
    });

    await expect(repository.players()).resolves.toEqual([{
      playerId: 8120,
      playerName: "Houston Texans",
      position: "DST",
      positions: ["DST"],
      teamAbbreviation: "HOU",
      fetchedAt,
    }]);
  });

  it("grants a refresh claim only once inside the cadence window", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const cadenceMs = 6 * 60 * 60 * 1000;
    const start = new Date("2026-09-10T12:00:00.000Z");

    await expect(repository.claimRefresh({ dataset: "players", now: start, cadenceMs }))
      .resolves.toBe(true);
    await expect(repository.claimRefresh({ dataset: "players", now: start, cadenceMs }))
      .resolves.toBe(false);
    await expect(repository.claimRefresh({
      dataset: "players",
      now: new Date(start.getTime() + cadenceMs - 1),
      cadenceMs,
    })).resolves.toBe(false);
    await expect(repository.claimRefresh({
      dataset: "players",
      now: new Date(start.getTime() + cadenceMs),
      cadenceMs,
    })).resolves.toBe(true);
  });

  it("claims each dataset independently", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const now = new Date("2026-09-10T12:00:00.000Z");

    await expect(repository.claimRefresh({ dataset: "rankings-ros", now, cadenceMs: 1000 }))
      .resolves.toBe(true);
    await expect(repository.claimRefresh({ dataset: "rankings-weekly", now, cadenceMs: 1000 }))
      .resolves.toBe(true);
  });

  it("accumulates request counts and clears the error after a success", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const now = new Date("2026-09-10T12:00:00.000Z");
    await repository.claimRefresh({ dataset: "players", now, cadenceMs: 1000 });

    await repository.recordRefreshOutcome({
      dataset: "players",
      now,
      requestCount: 1,
      error: "FantasyPros request to /nfl/players failed with 500.",
    });
    await expect(repository.datasetStatuses()).resolves.toEqual([{
      dataset: "players",
      lastFetchedAt: now.toISOString(),
      lastSucceededAt: undefined,
      requestCount: 1,
      rowCount: 0,
      lastError: "FantasyPros request to /nfl/players failed with 500.",
    }]);

    const later = new Date("2026-09-11T12:00:00.000Z");
    await repository.recordRefreshOutcome({
      dataset: "players",
      now: later,
      requestCount: 1,
      rowCount: 8525,
    });
    await expect(repository.datasetStatuses()).resolves.toEqual([{
      dataset: "players",
      lastFetchedAt: now.toISOString(),
      lastSucceededAt: later.toISOString(),
      requestCount: 2,
      rowCount: 8525,
      lastError: undefined,
    }]);
  });

  it("reports no dataset status before the first refresh", async () => {
    await expect(new InMemoryFantasyProsRepository().datasetStatuses()).resolves.toEqual([]);
  });
});
