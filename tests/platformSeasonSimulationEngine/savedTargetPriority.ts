import { expect, it } from "vitest";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";
import { catalogPlayer } from "./simulationFixtures.js";

export const registerSavedTargetPriorityTests = (): void => {
  it("drafts an uncapped saved target before spending its position and budget elsewhere", () => {
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
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 2,
          lineup: { QB: 1, BENCH: 1 },
          lineupSlotCount: 1,
          rosterMaximums: { QB: 2, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
        },
      },
    };
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [],
      playerCatalog: [
        { name: "Jared Goff", position: "QB", expectedPrice: 1, week1Projection: 16 },
        ...Array.from({ length: 27 }, (_, index) => catalogPlayer({
          name: index === 0 ? "Josh Allen" : `Quarterback ${index + 2}`,
          position: "QB",
          expectedPrice: Math.max(1, 30 - index),
          week1Projection: 30 - index * 0.25,
        })),
      ],
    };

    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: largeTeams.at(-1)?.id ?? "large-team-14",
      runCount: 3,
      targetConstraints: [{ playerName: "Jared Goff" }],
      seedPrefix: "saved-mandatory-quarterback-target",
    });

    expect(result.targetOutcome).toMatchObject({
      playerName: "Jared Goff",
      hitCount: 3,
      hitRate: 1,
    });
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.isUserTeam)?.roster ?? [];
      expect(roster).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerName: "Jared Goff" }),
      ]));
    }
  });
};
