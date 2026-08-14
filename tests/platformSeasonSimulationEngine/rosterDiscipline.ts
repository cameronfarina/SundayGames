import { expect, it } from "vitest";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";
import { catalogPlayer } from "./simulationFixtures.js";

export const registerRosterDisciplineTests = (): void => {
  it("does not let AI teams complete auction rosters with material unused budget", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      seedPrefix: "auction-spend-discipline",
    });

    for (const run of result.runs) {
      const aiTeams = run.teams.filter(team => !team.isUserTeam);
      expect(aiTeams.every(team => team.roster.length === auctionSeason.settings.roster.rosterSize))
        .toBe(true);
      for (const team of aiTeams) {
        expect(
          team.budgetRemaining,
          `${team.teamName} should not finish with material unused budget: ${JSON.stringify(team.roster)}`,
        ).toBeLessThanOrEqual(auctionSeason.settings.auction.minimumBidDollars);
      }
    }
  });

  it("protects viable starting quarterbacks and projected depth while filling auction rosters", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 50, minimumBidDollars: 1 },
        roster: {
          rosterSize: 4,
          lineup: { QB: 1, WR: 1, FLEX: 1, BENCH: 1 },
          lineupSlotCount: 3,
          rosterMaximums: { QB: 2, RB: 3, WR: 3, TE: 0, K: 0, DST: 0 },
        },
      },
    };
    const startingQuarterbacks = Array.from({ length: 4 }, (_, index) => catalogPlayer({
      name: `Starting Quarterback ${index + 1}`,
      position: "QB",
      expectedPrice: 4,
      week1Projection: 18 - index,
      weeks1To4Projection: 70 - index,
      seasonProjection: 280 - index,
    }));
    const backupQuarterbacks = Array.from({ length: 4 }, (_, index) => catalogPlayer({
      name: `Backup Quarterback ${index + 1}`,
      position: "QB",
      expectedPrice: 1,
      week1Projection: 0.5 - index * 0.05,
      weeks1To4Projection: 2 - index * 0.1,
      seasonProjection: 10 - index,
    }));
    const depthPlayers = Array.from({ length: 12 }, (_, index) => catalogPlayer({
      name: `Projected Depth ${index + 1}`,
      position: index % 3 === 0 ? "RB" : "WR",
      expectedPrice: index === 0 ? 22 : Math.max(1, 12 - index),
      week1Projection: 12 - index * 0.4,
      weeks1To4Projection: 48 - index,
      seasonProjection: 190 - index * 3,
    }));
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [{
        teamId: "team-1",
        playerId: "projected depth 12",
        playerName: "Projected Depth 12",
        position: "WR",
        price: 24,
        source: "keeper",
      }],
      playerCatalog: [
        ...startingQuarterbacks,
        ...backupQuarterbacks,
        ...depthPlayers,
      ],
    };

    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Projected Depth 1 for no more than $22",
      seedPrefix: "viable-starting-lineups",
    });

    for (const team of result.runs[0]?.teams ?? []) {
      const quarterback = team.roster.find(player => player.rosterSlot === "QB");
      expect(
        quarterback?.week1Points,
        `${team.teamName} drafted a non-viable starting quarterback: ${JSON.stringify(team.roster)}`,
      ).toBeGreaterThanOrEqual(15);
      expect(
        team.roster
          .filter(player => player.rosterSlot.startsWith("BENCH"))
          .every(player => player.position === "RB" || player.position === "WR"),
        `${team.teamName} used a bench slot on a specialist: ${JSON.stringify(team.roster)}`,
      ).toBe(true);
    }
    const humanRoster = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster ?? [];
    expect(humanRoster.filter(player => player.rosterSlot.startsWith("BENCH")))
      .toEqual([expect.objectContaining({ playerName: expect.stringMatching(/^Projected Depth /) })]);
  });
};
