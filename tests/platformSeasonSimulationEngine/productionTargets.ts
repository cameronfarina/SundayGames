import { expect, it } from "vitest";
import type { Position } from "../../config/league.js";
import { canonicalPlayerIdentityKey } from "../../src/data/normalizePlayerName.js";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const registerProductionTargetTests = (): void => {
  it("drafts every feasible uncapped target in a production-sized auction plan", () => {
    const largeTeams = Array.from({ length: 14 }, (_, index) => ({
      id: `large-team-${index + 1}`,
      leagueSeasonId: "season-2026",
      ownerId: `large-owner-${index + 1}`,
      ownerDisplayName: `Owner ${index + 1}`,
      displayName: `Team ${index + 1}`,
      draftOrderPosition: index + 1,
    }));
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      teams: largeTeams,
      settings: {
        ...auctionSeason.settings,
        expectedTeamCount: largeTeams.length,
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
        roster: {
          rosterSize: 16,
          lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 7 },
          lineupSlotCount: 9,
          rosterMaximums: { QB: 8, RB: 10, WR: 10, TE: 8, K: 8, DST: 8 },
        },
      },
    };
    const targets: LiveDraftRoomSetup["playerCatalog"] = [
      { name: "Jadarian Price", position: "RB", expectedPrice: 14, week1Projection: 12.9 },
      { name: "Ja'Marr Chase", position: "WR", expectedPrice: 74, week1Projection: 17 },
      { name: "Jared Goff", position: "QB", expectedPrice: 1, week1Projection: 18 },
      { name: "Jaylen Warren", position: "RB", expectedPrice: 12, week1Projection: 11.2 },
      { name: "Ladd McConkey", position: "WR", expectedPrice: 23, week1Projection: 11.4 },
    ];
    const depthPositionCounts: ReadonlyArray<readonly [Position, number]> = [
      ["QB", 28],
      ["RB", 84],
      ["WR", 84],
      ["TE", 28],
      ["K", 28],
      ["DST", 28],
    ];
    const depthPlayers = depthPositionCounts.flatMap(([position, count]) =>
      Array.from({ length: count }, (_, index) => ({
        name: `Depth ${position} ${index + 1}`,
        position,
        expectedPrice: Math.max(1, 35 - index),
        week1Projection: Math.max(1, 20 - index * 0.2),
      }))
    );
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [{
        teamId: "large-team-7",
        playerId: "devonta smith",
        playerName: "DeVonta Smith",
        position: "WR",
        price: 24,
        source: "keeper",
      }],
      playerCatalog: [
        ...targets,
        { name: "DeVonta Smith", position: "WR", expectedPrice: 24, week1Projection: 12.1 },
        ...depthPlayers,
      ],
    };
    const targetHumanValues: Readonly<Record<string, number>> = {
      "jadarian price": 15,
      "jamarr chase": 81,
      "jared goff": 1,
      "jaylen warren": 13,
      "ladd mcconkey": 25,
    };
    const playerHumanValues = Object.fromEntries(setup.playerCatalog.map(player => [
      canonicalPlayerIdentityKey(player.name),
      targetHumanValues[canonicalPlayerIdentityKey(player.name)] ?? player.expectedPrice + 5,
    ]));

    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "large-team-7",
      runCount: 3,
      strategyInput: "draft jadarian price. draft Ja'Marr chase. draft jared goff. draft jaylen warren. draft ladd.",
      playerHumanValues,
      seedPrefix: "production-five-target-plan",
    });

    expect(result.strategy.warnings).toEqual([]);
    expect(result.targetOutcomes?.map(outcome => ({
      playerName: outcome.playerName,
      hitCount: outcome.hitCount,
    }))).toEqual(targets.map(target => ({ playerName: target.name, hitCount: 3 })));
    for (const run of result.runs) {
      const humanTeam = run.teams.find(team => team.isUserTeam);
      expect(humanTeam?.roster.filter(player =>
        targets.some(target => target.name === player.playerName)
      )).toHaveLength(targets.length);
      expect(humanTeam?.roster).toHaveLength(season.settings.roster.rosterSize);
      expect(humanTeam?.budgetRemaining).toBe(0);
      expect(run.teams.every(team => team.roster.length === season.settings.roster.rosterSize))
        .toBe(true);
      expect(run.teams.every(team => team.budgetRemaining === 0)).toBe(true);
    }
  });
};
