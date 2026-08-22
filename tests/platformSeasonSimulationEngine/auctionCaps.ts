import { expect, it } from "vitest";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../src/platform/liveDraftRooms.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

const specialists = (
  position: LiveDraftRoomPlayerCatalogEntry["position"],
  namePrefix: string,
  expectedPrice: number,
): readonly LiveDraftRoomPlayerCatalogEntry[] =>
  Array.from({ length: 5 }, (_, index) => ({
    name: `${namePrefix} ${index + 1}`,
    position,
    expectedPrice,
    week1Projection: 9 - index,
  }));

const specialistSeason: LeagueSeason<AuctionLeagueSeasonSettings> = {
  ...auctionSeason,
  settings: {
    ...auctionSeason.settings,
    auction: { budgetDollars: 100, minimumBidDollars: 1 },
    roster: {
      rosterSize: 3,
      lineup: { RB: 1, K: 1, DST: 1 },
      lineupSlotCount: 3,
      rosterMaximums: { ...auctionSeason.settings.roster.rosterMaximums, RB: 3 },
    },
  },
};

const specialistSetup = {
  ...auctionSetup,
  initialRosters: [],
  playerCatalog: [
    ...auctionSetup.playerCatalog,
    ...specialists("K", "Kicker", 4),
    ...specialists("DST", "Defense", 6),
  ],
};

export const registerAuctionCapTests = (): void => {
  it("keeps the saved auction cap when strategy text repeats the same target", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Jadarian Price for no more than $20",
      targetConstraints: [{ playerName: "Jadarian Price", maxAuctionPrice: 12 }],
      seedPrefix: "saved-auction-cap-precedence",
    });

    expect(result.strategy.target).toMatchObject({
      playerName: "Jadarian Price",
      maxAuctionPrice: 12,
    });
  });

  it("applies multiple named player caps throughout each auction run", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 3,
          lineup: { RB: 1, FLEX: 1, BENCH: 1 },
          lineupSlotCount: 2,
          rosterMaximums: { ...auctionSeason.settings.roster.rosterMaximums, RB: 3 },
        },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: {
        ...auctionSetup,
        initialRosters: [],
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 50 },
          { name: "Premium Quarterback", position: "QB", expectedPrice: 60 },
          { name: "Premium Tight End", position: "TE", expectedPrice: 55 },
        ],
      },
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "draft jadarian price for no more than $20. Draft gibbs for no more than $76. Pair with gibbs",
      seedPrefix: "two-target-plan",
    });

    expect(result.strategy.warnings).toEqual([
      "Pair-with player gibbs is not a keeper; the simulation will also prioritize acquiring that player.",
    ]);
    expect(result.targetOutcomes).toHaveLength(2);
    expect(result.targetOutcomes?.map(outcome => outcome.playerName))
      .toEqual(["Jadarian Price", "Jahmyr Gibbs"]);
    expect(result.targetOutcomes?.every(outcome => outcome.hitCount === 3)).toBe(true);
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      expect(roster[0]?.playerName).toBe("Jadarian Price");
      const jadarian = roster.find(player => player.playerName === "Jadarian Price");
      const gibbs = roster.find(player => player.playerName === "Jahmyr Gibbs");
      if (jadarian !== undefined) expect(jadarian.price).toBeLessThanOrEqual(20);
      if (gibbs !== undefined) expect(gibbs.price).toBeLessThanOrEqual(76);
    }
  });

  it("allows a named target above the cap while capping another player at that position", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        roster: {
          rosterSize: 3,
          lineup: { RB: 1, WR: 2 },
          lineupSlotCount: 3,
          rosterMaximums: { ...auctionSeason.settings.roster.rosterMaximums, WR: 2 },
        },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: {
        ...auctionSetup,
        initialRosters: [],
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: "Receiver Six", position: "WR", expectedPrice: 3 },
          { name: "Receiver Seven", position: "WR", expectedPrice: 2 },
          { name: "Receiver Eight", position: "WR", expectedPrice: 1 },
        ],
      },
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "Draft Receiver One for no more than $30. Do not spend over $10 on another WR.",
      seedPrefix: "receiver-cap-plan",
    });

    expect(result.strategy.warnings).toEqual([]);
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      const target = roster.find(player => player.playerName === "Receiver One");
      const otherReceiver = roster.find(player =>
        player.position === "WR" && player.playerName !== "Receiver One"
      );
      expect(target?.price).toBeGreaterThan(10);
      expect(target?.price).toBeLessThanOrEqual(30);
      expect(otherReceiver?.price).toBeLessThanOrEqual(10);
    }
  });

  it("does not exceed a counted auction preference or its price cap", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "Draft 2 elite RBs for no more than $10 each",
      seedPrefix: "counted-rb-plan",
    });

    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      const draftedRunningBacks = roster.filter(player =>
        player.position === "RB" && player.source !== "keeper"
      );
      expect(draftedRunningBacks.length).toBeLessThanOrEqual(1);
      expect(draftedRunningBacks.every(player => (player.price ?? 0) <= 10)).toBe(true);
    }
  });

  it("fills every kicker and defense slot at two dollars", () => {
    const result = runSeasonSimulations({
      season: specialistSeason,
      setup: specialistSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "",
      seedPrefix: "flat-priced-specialists",
    });
    const drafted = result.runs.flatMap(run => run.teams.flatMap(team =>
      team.roster.filter(player => player.position === "K" || player.position === "DST")));

    expect(drafted.length).toBeGreaterThan(0);
    expect(drafted.every(player => (player.price ?? 0) <= 2)).toBe(true);
  });

  it("buys a named defense while no rival bids past the flat price", () => {
    const result = runSeasonSimulations({
      season: specialistSeason,
      setup: specialistSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "draft defense 3 for no more than $8",
      seedPrefix: "named-defense-target",
    });

    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      expect(roster.map(player => player.playerName)).toContain("Defense 3");
      expect(roster.find(player => player.playerName === "Defense 3")?.price).toBe(3);
      const rivalDefenses = run.teams
        .filter(team => team.teamId !== "team-1")
        .flatMap(team => team.roster.filter(player => player.position === "DST"));
      expect(rivalDefenses.every(player => (player.price ?? 0) <= 2)).toBe(true);
    }
  });
};
