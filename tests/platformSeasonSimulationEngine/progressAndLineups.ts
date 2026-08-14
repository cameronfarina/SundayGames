import { expect, it } from "vitest";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const registerProgressAndLineupTests = (): void => {
  it("reports each completed league draft while a simulation batch runs", () => {
    const progress: Array<{ completed: number; total: number }> = [];

    runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "",
      seedPrefix: "progress-events",
    }, {
      onProgress: update => progress.push(update),
    });

    expect(progress).toEqual([
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);
  });

  it("scores the best legal Week 1 lineup instead of the draft-time slot assignment", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        roster: {
          ...auctionSeason.settings.roster,
          lineup: { RB: 1, BENCH: 1 },
          lineupSlotCount: 1,
        },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: {
        ...auctionSetup,
        initialRosters: [
          ...auctionSetup.initialRosters,
          {
            teamId: "team-1",
            playerId: "jadarian price",
            playerName: "Jadarian Price",
            position: "RB",
            price: 10,
            source: "keeper",
          },
        ],
      },
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Jadarian Price for no more than $20",
      week1Projections: {
        "devon achane": 1,
        "jadarian price": 50,
      },
      seedPrefix: "optimal-lineup",
    });
    const team = result.runs[0]?.teams.find(candidate => candidate.teamId === "team-1");

    expect(team?.week1Points).toBe(50);
    expect(team?.roster.find(player => player.playerName === "Jadarian Price"))
      .toMatchObject({ rosterSlot: "RB", starter: true, week1Points: 50 });
    expect(team?.roster.find(player => player.playerName === "De'Von Achane"))
      .toMatchObject({ rosterSlot: "BENCH", starter: false, week1Points: 1 });
  });
};
