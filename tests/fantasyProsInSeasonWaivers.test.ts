import { describe, expect, it } from "vitest";
import {
  InMemoryFantasyProsRepository,
  type SaveFantasyProsRankingsInput,
} from "../src/platform/fantasyPros.js";
import {
  buildFantasyProsInSeasonView,
  fantasyProsRosterView,
  loadFantasyProsInSeasonDataset,
  waiverCandidatesPerPosition,
  widelyAvailableOwnershipThreshold,
  type FantasyProsRosterSource,
} from "../src/platform/fantasyProsInSeason.js";

const fetchedAt = "2026-09-17T09:00:00.000Z";

interface RankingSeed {
  playerId: number;
  playerName: string;
  position: string;
  teamAbbreviation?: string;
  rankEcr: number;
  ownedEspn?: number;
}

const rankings = (
  rankingType: SaveFantasyProsRankingsInput["rankingType"],
  seeds: readonly RankingSeed[],
): SaveFantasyProsRankingsInput => ({
  rankingType,
  scoring: "PPR",
  week: 0,
  fetchedAt,
  rankings: seeds,
});

const rostered: FantasyProsRosterSource["playerCatalog"] = [
  { name: "Puka Nacua", position: "WR", teamAbbreviation: "LAR" },
];

const available: FantasyProsRosterSource["playerCatalog"] = [
  { name: "Jalen Coker", position: "WR", teamAbbreviation: "CAR" },
  { name: "Tyler Shough", position: "QB", teamAbbreviation: "NO" },
  { name: "Baker Mayfield", position: "QB", teamAbbreviation: "TB" },
  { name: "Chig Okonkwo", position: "TE", teamAbbreviation: "TEN" },
  { name: "Undrafted Rookie", position: "WR", teamAbbreviation: "SEA" },
];

const room: FantasyProsRosterSource = {
  playerCatalog: [...rostered, ...available],
  projection: { teams: [{ teamId: "team-1", ownerId: "owner-1", roster: rostered }] },
};

const restOfSeasonSeeds: readonly RankingSeed[] = [
  { playerId: 3, playerName: "Puka Nacua", position: "WR", teamAbbreviation: "LAR", rankEcr: 6, ownedEspn: 99 },
  { playerId: 10, playerName: "Jalen Coker", position: "WR", teamAbbreviation: "CAR", rankEcr: 127, ownedEspn: 37 },
  { playerId: 11, playerName: "Tyler Shough", position: "QB", teamAbbreviation: "NO", rankEcr: 125, ownedEspn: 41.3 },
  { playerId: 12, playerName: "Baker Mayfield", position: "QB", teamAbbreviation: "TB", rankEcr: 118, ownedEspn: 96 },
  // FantasyPros published no ESPN ownership share for this one.
  { playerId: 13, playerName: "Chig Okonkwo", position: "TE", teamAbbreviation: "TEN", rankEcr: 141 },
];

const boardFor = async (
  repository: InMemoryFantasyProsRepository,
  source: FantasyProsRosterSource = room,
) => {
  const rosterView = fantasyProsRosterView(source, "team-1", "owner-1");
  if (rosterView === undefined) throw new Error("Expected the fixture roster.");
  return buildFantasyProsInSeasonView({
    configured: true,
    teamId: "team-1",
    ownerId: "owner-1",
    rosterView,
    starterSlots: [],
    dataset: await loadFantasyProsInSeasonDataset(repository),
  }).waivers;
};

describe("FantasyPros waiver board before the season starts", () => {
  it("stands in rest-of-season rankings for the empty waiver set and says so", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await repository.saveRankings(rankings("ros", restOfSeasonSeeds));

    const board = await boardFor(repository);

    expect(board.source).toBe("widely_available");
    expect(board.ownershipThreshold).toBe(widelyAvailableOwnershipThreshold);
    expect(board.players.map(player => player.playerName)).toEqual([
      "Tyler Shough",
      "Jalen Coker",
    ]);
  });

  it("leaves out a rostered player, a widely owned one, and one with no ownership share", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await repository.saveRankings(rankings("ros", restOfSeasonSeeds));

    const names = (await boardFor(repository)).players.map(player => player.playerName);

    expect(names).not.toContain("Puka Nacua");
    expect(names).not.toContain("Baker Mayfield");
    expect(names).not.toContain("Chig Okonkwo");
    expect(names).not.toContain("Undrafted Rookie");
  });

  it("carries the ownership share and the rest-of-season rank it sorted on", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await repository.saveRankings(rankings("ros", restOfSeasonSeeds));

    const board = await boardFor(repository);

    expect(board.players[0]).toMatchObject({
      playerName: "Tyler Shough",
      position: "QB",
      ownedEspn: 41.3,
      restOfSeason: { rankEcr: 125 },
    });
    expect(board.players[0]?.waiverRank).toBeUndefined();
  });
});

describe("FantasyPros waiver board once waiver rankings publish", () => {
  it("prefers the waiver set and stops filtering on ownership", async () => {
    const repository = new InMemoryFantasyProsRepository();
    await repository.saveRankings(rankings("ros", restOfSeasonSeeds));
    await repository.saveRankings(rankings("waiver", [
      { playerId: 12, playerName: "Baker Mayfield", position: "QB", teamAbbreviation: "TB", rankEcr: 2, ownedEspn: 96 },
      { playerId: 10, playerName: "Jalen Coker", position: "WR", teamAbbreviation: "CAR", rankEcr: 1, ownedEspn: 37 },
    ]));

    const board = await boardFor(repository);

    expect(board.source).toBe("waiver_rankings");
    expect(board.ownershipThreshold).toBeUndefined();
    expect(board.players.map(player => [player.playerName, player.waiverRank])).toEqual([
      ["Jalen Coker", 1],
      ["Baker Mayfield", 2],
    ]);
  });
});

describe("FantasyPros waiver board depth", () => {
  it("keeps a bounded number of candidates for each position", async () => {
    const extras = Array.from({ length: waiverCandidatesPerPosition + 5 }, (_, index) => ({
      playerId: 100 + index,
      playerName: `Deep Receiver ${String(index)}`,
      position: "WR",
      teamAbbreviation: "SEA",
      rankEcr: 200 + index,
      ownedEspn: 5,
    }));
    const repository = new InMemoryFantasyProsRepository();
    await repository.saveRankings(rankings("ros", [...restOfSeasonSeeds, ...extras]));

    const deepReceivers: FantasyProsRosterSource["playerCatalog"] = extras.map(extra => ({
      name: extra.playerName,
      position: "WR",
      teamAbbreviation: extra.teamAbbreviation,
    }));
    const board = await boardFor(repository, {
      playerCatalog: [...room.playerCatalog, ...deepReceivers],
      projection: room.projection,
    });
    const receivers = board.players.filter(player => player.position === "WR");

    expect(receivers).toHaveLength(waiverCandidatesPerPosition);
    // Jalen Coker outranks every filler, so the cut falls at the back of the list.
    expect(receivers[0]?.playerName).toBe("Jalen Coker");
    expect(receivers.map(player => player.playerName)).not.toContain("Deep Receiver 16");
  });
});
