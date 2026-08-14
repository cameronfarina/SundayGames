import { describe, expect, it } from "vitest";
import type { Position } from "../../config/league.js";
import type { ExplicitLeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { buildSeasonAuctionMockConfig } from "../../src/platform/seasonAuctionMock.js";
import { season, setup } from "./fixtures.js";

describe("season auction mock specialist depth", () => {
  it("caps specialist eligibility at 32 viable roles without promoting near-zero depth", () => {
    const specialistPositions: readonly Position[] = ["QB", "TE", "K", "DST"];
    const projectedRoleCount = 33;
    const viableRoleDepth = 32;
    const specialistSeason: ExplicitLeagueSeason = {
      ...season,
      settings: {
        ...season.settings,
        roster: {
          rosterSize: 6,
          lineup: { QB: 1, TE: 1, K: 1, DST: 1, BENCH: 2 },
          lineupSlotCount: 6,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 2, DST: 2 },
        },
      },
    };
    const specialistSetup: LiveDraftRoomSetup = {
      ...setup,
      initialRosters: [],
      playerCatalog: [
        ...specialistPositions.flatMap(position => [
          ...Array.from({ length: projectedRoleCount }, (_, index) => ({
            name: `${position} Viable ${index + 1}`,
            position,
            expectedPrice: Math.max(1, projectedRoleCount - index),
            teamAbbreviation: `NFL${index + 1}`,
            week1Projection: 20 - index * 0.1,
            weeks1To4Projection: 80 - index * 0.1,
            seasonProjection: 300 - index,
          })),
          {
            name: `${position} Near-Zero Backup`,
            position,
            expectedPrice: 1,
            week1Projection: 0.1,
            weeks1To4Projection: 0.4,
            seasonProjection: 1.7,
          },
        ]),
        { name: "RB Bench Depth", position: "RB", expectedPrice: 1, week1Projection: 1 },
        { name: "WR Bench Depth", position: "WR", expectedPrice: 1, week1Projection: 1 },
      ],
    };
    const config = buildSeasonAuctionMockConfig({
      season: specialistSeason,
      setup: specialistSetup,
      humanTeamId: "team-1",
      sessionId: "specialist-mock",
      seed: "specialist-seed",
    });

    for (const position of specialistPositions) {
      const players = config.players.filter(player => player.position === position);
      const viableNames = Array.from(
        { length: viableRoleDepth },
        (_, index) => `${position} Viable ${index + 1}`,
      );
      expect(players.filter(player => player.projectedStarter).map(player => player.name))
        .toEqual(viableNames);
      expect(players.filter(player => player.starterEligible).map(player => player.name))
        .toEqual(viableNames);
      expect(players.find(player => player.name === `${position} Viable ${projectedRoleCount}`))
        .toMatchObject({ starterEligible: false });
      const placeholder = players.find(player => player.name === `${position} Near-Zero Backup`);
      expect(placeholder).toMatchObject({ starterEligible: false });
      expect(placeholder).not.toHaveProperty("projectedStarter");
    }
    expect(config.players.find(player => player.name === "RB Bench Depth"))
      .not.toHaveProperty("starterEligible");
    expect(config.players.find(player => player.name === "WR Bench Depth"))
      .not.toHaveProperty("starterEligible");
  });
});
