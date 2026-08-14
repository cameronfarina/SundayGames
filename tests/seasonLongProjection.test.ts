import { describe, expect, it } from "vitest";
import { leagueConfig } from "../config/league.js";
import {
  applySeasonLongProjectionCalibrations,
  fantasyPointsForSeasonStatLine,
  type SeasonLongProjectionInput,
} from "../src/modeling/seasonLongProjection.js";
import {
  loadCurrentProjections,
  loadEspnWeeksOneToFour,
} from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const seasonLongProjectionPath = "data/raw/season-long-projections-2026.json";

const achaneSeasonLine: SeasonLongProjectionInput = {
  player: "De'Von Achane",
  position: "RB",
  provider: "Oddschecker and FantasyPros",
  sourceDate: "2026-08-13",
  sourceUrl: "https://www.oddschecker.com/us/football/nfl-specials/devon-achane",
  sourceUrls: [
    "https://www.oddschecker.com/us/football/nfl-specials/devon-achane/total-rushing-yards-regular-season",
    "https://www.fantasypros.com/nfl/projections/devon-achane.php",
  ],
  sourceDescription: "Oddschecker season markets blended with FantasyPros receiving-volume ratios",
  stats: {
    rushingYards: 974.5,
    rushingTouchdowns: 5.5,
    receptions: 53.3,
    receivingYards: 400.5,
    receivingTouchdowns: 3.3,
  },
};

describe("season-long projection calibration", () => {
  it("converts Achane's season stat line with the configured half-PPR scoring", () => {
    expect(fantasyPointsForSeasonStatLine(achaneSeasonLine.stats, leagueConfig.scoring)).toEqual({
      rushingYards: 97.45,
      rushingTouchdowns: 33,
      receptions: 26.65,
      receivingYards: 40.05,
      receivingTouchdowns: 19.8,
      total: 216.95,
    });
  });

  it("preserves ESPN's weekly shape while scaling it to the season-long total", async () => {
    const baseline = await loadEspnWeeksOneToFour(projectionPath);
    const baselineAchane = baseline.find(player => player.name === "De'Von Achane");
    if (baselineAchane === undefined) throw new Error("Expected the Achane projection.");

    const [calibratedAchane] = applySeasonLongProjectionCalibrations(
      [baselineAchane],
      [achaneSeasonLine],
      leagueConfig.scoring,
    );
    const scaleFactor = 216.95 / 260.39769621;

    expect(calibratedAchane).toMatchObject({
      name: "De'Von Achane",
      seasonProjection: 216.95,
      projectionCalibration: {
        provider: "Oddschecker and FantasyPros",
        sourceDate: "2026-08-13",
        sourceUrl: "https://www.oddschecker.com/us/football/nfl-specials/devon-achane",
        sourceUrls: [
          "https://www.oddschecker.com/us/football/nfl-specials/devon-achane/total-rushing-yards-regular-season",
          "https://www.fantasypros.com/nfl/projections/devon-achane.php",
        ],
        baselineSeasonProjection: 260.39769621,
        calibratedSeasonProjection: 216.95,
        weeklyScaleFactor: expect.closeTo(scaleFactor, 8),
        scoring: leagueConfig.scoring,
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

    expect(achane?.seasonProjection).toBe(216.95);
    expect(achane?.projectionCalibration?.sourceDescription)
      .toContain("Oddschecker conservative 974.5 rushing-yard line");
    expect(gibbs?.projectionCalibration).toMatchObject({
      provider: "Oddschecker and FantasyPros",
      calibratedSeasonProjection: 292.55,
    });
  });
});
