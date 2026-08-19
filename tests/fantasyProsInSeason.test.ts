import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryFantasyProsRepository,
  type SaveFantasyProsRankingsInput,
} from "../src/platform/fantasyPros.js";
import {
  buildFantasyProsInSeasonView,
  emptyFantasyProsInSeasonDataset,
  fantasyProsRosterView,
  loadFantasyProsInSeasonDataset,
  type FantasyProsRosterSource,
} from "../src/platform/fantasyProsInSeason.js";
import type { PostDraftStarterSlot } from "../src/platform/postDraftTeamAnalysis.js";

const fetchedAt = "2026-09-17T09:00:00.000Z";

const starterSlots: readonly PostDraftStarterSlot[] = [
  { slot: "QB", eligiblePositions: ["QB"] },
  { slot: "RB1", eligiblePositions: ["RB"] },
  { slot: "RB2", eligiblePositions: ["RB"] },
  { slot: "WR1", eligiblePositions: ["WR"] },
  { slot: "WR2", eligiblePositions: ["WR"] },
  { slot: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  { slot: "DST", eligiblePositions: ["DST"] },
];

const roster: FantasyProsRosterSource["projection"]["teams"][number]["roster"] = [
  { name: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET", byeWeek: 6 },
  { name: "De'Von Achane", position: "RB", teamAbbreviation: "MIA" },
  { name: "Puka Nacua", position: "WR", teamAbbreviation: "LAR" },
  { name: "Jayden Higgins", position: "WR", teamAbbreviation: "HOU" },
  { name: "Xavier Legette", position: "WR", teamAbbreviation: "CAR" },
  { name: "Cade Otton", position: "TE", teamAbbreviation: "TB" },
  // ESPN spells this JAX; FantasyPros spells it JAC.
  { name: "Trevor Lawrence", position: "QB", teamAbbreviation: "JAX" },
  { name: "Jordan Love", position: "QB", teamAbbreviation: "GB" },
  { name: "Texans D/ST", position: "DST", teamAbbreviation: "HOU" },
];

const freeAgents: FantasyProsRosterSource["playerCatalog"] = [
  { name: "Jalen Coker", position: "WR", teamAbbreviation: "CAR" },
  { name: "Tyler Shough", position: "QB", teamAbbreviation: "NO" },
  { name: "Baker Mayfield", position: "QB", teamAbbreviation: "TB" },
  { name: "Chig Okonkwo", position: "TE", teamAbbreviation: "TEN" },
  { name: "Undrafted Rookie", position: "WR", teamAbbreviation: "SEA" },
];

const room: FantasyProsRosterSource = {
  playerCatalog: [...roster, ...freeAgents],
  projection: {
    teams: [
      { teamId: "team-1", ownerId: "owner-1", roster },
      { teamId: "team-2", ownerId: "owner-2", roster: [] },
    ],
  },
};

interface RankingSeed {
  playerId: number;
  playerName: string;
  position: string;
  teamAbbreviation?: string;
  rankEcr: number;
  tier?: number;
  ownedEspn?: number;
}

const rankingsInput = (
  rankingType: SaveFantasyProsRankingsInput["rankingType"],
  week: number,
  seeds: readonly RankingSeed[],
): SaveFantasyProsRankingsInput => ({
  rankingType,
  scoring: "PPR",
  week,
  fetchedAt,
  rankings: seeds,
});

// Weekly consensus is FLX only: no quarterbacks, kickers, or defenses, and the
// endpoint publishes neither a tier nor an ECR delta for it.
const weeklySeeds: readonly RankingSeed[] = [
  { playerId: 1, playerName: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET", rankEcr: 1 },
  { playerId: 3, playerName: "Puka Nacua", position: "WR", teamAbbreviation: "LAR", rankEcr: 5 },
  { playerId: 5, playerName: "Xavier Legette", position: "WR", teamAbbreviation: "CAR", rankEcr: 32 },
  { playerId: 2, playerName: "De'Von Achane", position: "RB", teamAbbreviation: "MIA", rankEcr: 9 },
  { playerId: 4, playerName: "Jayden Higgins", position: "WR", teamAbbreviation: "HOU", rankEcr: 30 },
  { playerId: 6, playerName: "Cade Otton", position: "TE", teamAbbreviation: "TB", rankEcr: 35 },
];

const restOfSeasonSeeds: readonly RankingSeed[] = [
  { playerId: 1, playerName: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET", rankEcr: 3, tier: 1, ownedEspn: 99.9 },
  { playerId: 2, playerName: "De'Von Achane", position: "RB", teamAbbreviation: "MIA", rankEcr: 12, tier: 2, ownedEspn: 99 },
  { playerId: 3, playerName: "Puka Nacua", position: "WR", teamAbbreviation: "LAR", rankEcr: 6, tier: 2, ownedEspn: 99 },
  { playerId: 4, playerName: "Jayden Higgins", position: "WR", teamAbbreviation: "HOU", rankEcr: 55, tier: 6, ownedEspn: 80 },
  { playerId: 5, playerName: "Xavier Legette", position: "WR", teamAbbreviation: "CAR", rankEcr: 130, tier: 12, ownedEspn: 60 },
  { playerId: 6, playerName: "Cade Otton", position: "TE", teamAbbreviation: "TB", rankEcr: 140, tier: 13, ownedEspn: 55 },
  { playerId: 7, playerName: "Trevor Lawrence", position: "QB", teamAbbreviation: "JAC", rankEcr: 60, tier: 6, ownedEspn: 70 },
  { playerId: 8, playerName: "Jordan Love", position: "QB", teamAbbreviation: "GB", rankEcr: 40, tier: 4, ownedEspn: 85 },
  { playerId: 9, playerName: "Houston Texans", position: "DST", teamAbbreviation: "HOU", rankEcr: 150, tier: 14, ownedEspn: 50 },
  { playerId: 10, playerName: "Jalen Coker", position: "WR", teamAbbreviation: "CAR", rankEcr: 127, tier: 12, ownedEspn: 37 },
  { playerId: 11, playerName: "Tyler Shough", position: "QB", teamAbbreviation: "NO", rankEcr: 125, tier: 12, ownedEspn: 41.3 },
  { playerId: 12, playerName: "Baker Mayfield", position: "QB", teamAbbreviation: "TB", rankEcr: 118, tier: 11, ownedEspn: 96 },
  { playerId: 13, playerName: "Chig Okonkwo", position: "TE", teamAbbreviation: "TEN", rankEcr: 141, tier: 13 },
];

const weeklyPoints: ReadonlyMap<number, number> = new Map([
  [1, 19.4], [2, 15.1], [3, 16], [4, 12], [5, 9], [6, 11],
  [7, 18], [8, 16], [9, 7.5],
]);

const seedRepository = async (
  repository: InMemoryFantasyProsRepository,
): Promise<void> => {
  // A stale week is left in the store on purpose: the loader must ignore it.
  await repository.saveRankings(rankingsInput("weekly", 1, [
    { playerId: 2, playerName: "De'Von Achane", position: "RB", rankEcr: 1 },
  ]));
  await repository.saveRankings(rankingsInput("weekly", 2, weeklySeeds));
  await repository.saveRankings(rankingsInput("ros", 0, restOfSeasonSeeds));
  await repository.saveProjections({
    week: 2,
    position: "RB",
    fetchedAt,
    projections: [...weeklyPoints].map(([playerId, pointsPpr]) => {
      const seed = restOfSeasonSeeds.find(candidate => candidate.playerId === playerId);
      return {
        playerId,
        playerName: seed?.playerName ?? "Unknown",
        position: seed?.position ?? "RB",
        pointsPpr,
      };
    }),
  });
};

const viewFor = async (repository: InMemoryFantasyProsRepository) => {
  const rosterView = fantasyProsRosterView(room, "team-1", "owner-1");
  if (rosterView === undefined) throw new Error("Expected the fixture roster.");
  return buildFantasyProsInSeasonView({
    configured: true,
    teamId: "team-1",
    ownerId: "owner-1",
    rosterView,
    starterSlots,
    dataset: await loadFantasyProsInSeasonDataset(repository),
  });
};

describe("FantasyPros in-season roster view", () => {
  it("returns the claimed roster and treats every undrafted catalog name as a free agent", () => {
    const view = fantasyProsRosterView(room, "team-1", "owner-1");

    expect(view?.players.map(player => player.name)).toEqual(roster.map(player => player.name));
    expect(view?.freeAgents.map(player => player.name)).toEqual(freeAgents.map(player => player.name));
  });

  it("refuses a team the requesting owner does not hold", () => {
    expect(fantasyProsRosterView(room, "team-2", "owner-1")).toBeUndefined();
    expect(fantasyProsRosterView(room, "team-9", "owner-9")).toBeUndefined();
  });
});

describe("FantasyPros in-season view", () => {
  let repository: InMemoryFantasyProsRepository;

  beforeEach(async () => {
    repository = new InMemoryFantasyProsRepository();
    await seedRepository(repository);
  });

  it("reports the newest stored week and ignores rankings from an earlier one", async () => {
    const view = await viewFor(repository);
    const achane = view.players.find(player => player.playerName === "De'Von Achane");

    expect(view.week).toBe(2);
    expect(view.updatedAt).toBe(fetchedAt);
    expect(achane?.weekly?.rankEcr).toBe(9);
  });

  it("joins both ranking horizons and both projections onto a matched player", async () => {
    const view = await viewFor(repository);
    const gibbs = view.players.find(player => player.playerName === "Jahmyr Gibbs");

    expect(gibbs).toMatchObject({
      fantasyProsPlayerId: 1,
      byeWeek: 6,
      weekly: { rankEcr: 1 },
      restOfSeason: { rankEcr: 3, tier: 1 },
      weeklyProjectedPoints: 19.4,
    });
    // Weekly consensus publishes no tier; only the rest-of-season set does.
    expect(gibbs?.weekly?.tier).toBeUndefined();
  });

  it("matches across team spelling dialects and models a defense as its team", async () => {
    const view = await viewFor(repository);

    expect(view.players.find(player => player.playerName === "Trevor Lawrence"))
      .toMatchObject({ fantasyProsPlayerId: 7, restOfSeason: { rankEcr: 60 } });
    expect(view.players.find(player => player.playerName === "Texans D/ST"))
      .toMatchObject({ fantasyProsPlayerId: 9, restOfSeason: { rankEcr: 150 } });
  });

  it("leaves a quarterback without a weekly rank rather than inventing one", async () => {
    const view = await viewFor(repository);
    const lawrence = view.players.find(player => player.playerName === "Trevor Lawrence");

    expect(lawrence?.weekly).toBeUndefined();
    expect(lawrence?.weeklyProjectedPoints).toBe(18);
  });

  it("carries no FantasyPros fields at all for a player it could not match", async () => {
    const rosterView = fantasyProsRosterView(room, "team-1", "owner-1");
    if (rosterView === undefined) throw new Error("Expected the fixture roster.");
    const view = buildFantasyProsInSeasonView({
      configured: false,
      teamId: "team-1",
      ownerId: "owner-1",
      rosterView,
      starterSlots,
      dataset: emptyFantasyProsInSeasonDataset(),
    });

    expect(view.configured).toBe(false);
    expect(view.week).toBeUndefined();
    expect(view.lineup).toBeUndefined();
    expect(view.waivers.players).toEqual([]);
    expect(view.players[0]).toEqual({
      playerId: "draft-player:jahmyr gibbs",
      playerName: "Jahmyr Gibbs",
      position: "RB",
      teamAbbreviation: "DET",
      byeWeek: 6,
    });
  });
});

describe("FantasyPros in-season lineup", () => {
  let repository: InMemoryFantasyProsRepository;

  beforeEach(async () => {
    repository = new InMemoryFantasyProsRepository();
    await seedRepository(repository);
  });

  it("fills every starter slot from the weekly projections", async () => {
    const view = await viewFor(repository);

    expect(view.lineup?.basis).toBe("weekly_projection");
    expect(view.lineup?.slots.map(slot => [slot.slot, slot.start.playerName])).toEqual([
      ["QB", "Trevor Lawrence"],
      ["RB1", "Jahmyr Gibbs"],
      ["RB2", "De'Von Achane"],
      ["WR1", "Puka Nacua"],
      ["WR2", "Jayden Higgins"],
      ["FLEX", "Cade Otton"],
      ["DST", "Texans D/ST"],
    ]);
  });

  it("names the closest bench alternative and the points it gives up", async () => {
    const view = await viewFor(repository);
    const flex = view.lineup?.slots.find(slot => slot.slot === "FLEX");

    expect(flex?.bench?.playerName).toBe("Xavier Legette");
    expect(flex?.pointEdge).toBe(2);
  });

  it("flags a starter the weekly consensus ranks behind his own bench", async () => {
    const view = await viewFor(repository);
    const flex = view.lineup?.slots.find(slot => slot.slot === "FLEX");

    expect(flex?.concern).toEqual({
      basis: "weekly_ecr",
      rankGap: 3,
      message: "FantasyPros ranks Xavier Legette 3 spots ahead of Cade Otton in this week's consensus.",
    });
  });

  it("falls back to the rest-of-season rank where no weekly consensus exists", async () => {
    const view = await viewFor(repository);
    const quarterback = view.lineup?.slots.find(slot => slot.slot === "QB");

    expect(quarterback?.concern).toEqual({
      basis: "rest_of_season_rank",
      rankGap: 20,
      message: "FantasyPros ranks Jordan Love 20 spots ahead of Trevor Lawrence in the rest-of-season consensus.",
    });
  });

  it("stays silent when the consensus agrees with the projection", async () => {
    const view = await viewFor(repository);

    // Legette is the best bench option for all three flex-eligible slots, but
    // the consensus only prefers him over the tight end.
    expect(view.lineup?.slots.find(slot => slot.slot === "WR1")?.bench?.playerName).toBe("Xavier Legette");
    expect(view.lineup?.slots.find(slot => slot.slot === "WR1")?.concern).toBeUndefined();
    expect(view.lineup?.slots.find(slot => slot.slot === "WR2")?.concern).toBeUndefined();
  });

  it("assigns on rest-of-season points when no weekly projection has been published", async () => {
    const bare = new InMemoryFantasyProsRepository();
    await bare.saveRankings(rankingsInput("ros", 0, restOfSeasonSeeds));
    await bare.saveProjections({
      week: 0,
      position: "RB",
      fetchedAt,
      projections: restOfSeasonSeeds.map(seed => ({
        playerId: seed.playerId,
        playerName: seed.playerName,
        position: seed.position,
        pointsPpr: 300 - seed.rankEcr,
      })),
    });

    const view = await viewFor(bare);

    expect(view.week).toBeUndefined();
    expect(view.lineup?.basis).toBe("rest_of_season_projection");
    expect(view.lineup?.slots.find(slot => slot.slot === "QB")?.start.playerName).toBe("Jordan Love");
  });
});
