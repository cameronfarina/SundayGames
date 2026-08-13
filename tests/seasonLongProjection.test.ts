import { describe, expect, it } from "vitest";
import { leagueConfig } from "../config/league.js";
import {
  applySeasonLongProjectionCalibrations,
  fantasyPointsForSeasonStatLine,
} from "../src/modeling/seasonLongProjection.js";
import {
  loadCurrentProjections,
  loadEspnWeeksOneToFour,
} from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const seasonLongProjectionPath = "data/raw/season-long-projections-2026.json";

const achaneSeasonLine = {
  player: "De'Von Achane",
  position: "RB" as const,
  provider: "First Down Studio",
  sourceDate: "2026-08-12",
  sourceUrl: "https://www.firstdown.studio/season-rankings/flex",
  sourceDescription: "Vegas prop-driven season projection",
  stats: {
    rushingYards: 979,
    rushingTouchdowns: 5.3,
    receptions: 58,
    receivingYards: 375,
    receivingTouchdowns: 2,
  },
};

describe("season-long projection calibration", () => {
  it("converts Achane's season stat line with the configured half-PPR scoring", () => {
    expect(fantasyPointsForSeasonStatLine(achaneSeasonLine.stats, leagueConfig.scoring)).toEqual({
      rushingYards: 97.9,
      rushingTouchdowns: 31.8,
      receptions: 29,
      receivingYards: 37.5,
      receivingTouchdowns: 12,
      total: 208.2,
    });
  });

  it("preserves ESPN's weekly shape while scaling it to the season-long total", async () => {
    const baseline = await loadEspnWeeksOneToFour(projectionPath);
    const baselineAchane = baseline.find(player => player.name === "De'Von Achane");
    expect(baselineAchane).toBeDefined();

    const [calibratedAchane] = applySeasonLongProjectionCalibrations(
      [baselineAchane!],
      [achaneSeasonLine],
      leagueConfig.scoring,
    );
    const scaleFactor = 208.2 / 260.39769621;

    expect(calibratedAchane).toMatchObject({
      name: "De'Von Achane",
      seasonProjection: 208.2,
      projectionCalibration: {
        provider: "First Down Studio",
        sourceDate: "2026-08-12",
        sourceUrl: "https://www.firstdown.studio/season-rankings/flex",
        baselineSeasonProjection: 260.39769621,
        calibratedSeasonProjection: 208.2,
        weeklyScaleFactor: expect.closeTo(scaleFactor, 8),
      },
    });
    expect(calibratedAchane?.weeks[1]).toBeCloseTo(16.03261953 * scaleFactor, 8);
    expect(calibratedAchane?.weeks1To4).toBeCloseTo(61.44814521 * scaleFactor, 8);
  });

  it("loads the current projection set with the documented Achane calibration", async () => {
    const projections = await loadCurrentProjections({
      projectionPath,
      seasonLongProjectionPath,
    });
    const achane = projections.find(player => player.name === "De'Von Achane");
    const gibbs = projections.find(player => player.name === "Jahmyr Gibbs");

    expect(achane?.seasonProjection).toBe(208.2);
    expect(achane?.projectionCalibration?.sourceDescription)
      .toBe("Vegas prop-driven season projection");
    expect(gibbs?.projectionCalibration).toBeUndefined();
  });
});
