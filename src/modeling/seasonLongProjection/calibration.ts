import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../../projections.js";
import type {
  SeasonLongProjectionCalibration,
  SeasonLongProjectionInput,
  SeasonProjectionScoring,
  SeasonProjectionScoringBreakdown,
} from "./contracts.js";
import { fantasyPointsForSeasonStatLine } from "./scoring.js";

const calibrationFor = (
  baseline: number,
  input: SeasonLongProjectionInput,
  scoring: SeasonProjectionScoring,
  breakdown: SeasonProjectionScoringBreakdown,
): SeasonLongProjectionCalibration => ({
  basis: "season-long stat line",
  provider: input.provider,
  sourceDate: input.sourceDate,
  sourceUrl: input.sourceUrl,
  sourceUrls: input.sourceUrls ?? [input.sourceUrl],
  sourceDescription: input.sourceDescription,
  baselineSeasonProjection: baseline,
  calibratedSeasonProjection: breakdown.total,
  weeklyScaleFactor: breakdown.total / baseline,
  scoring: { ...scoring },
  statLine: input.stats,
  scoringBreakdown: breakdown,
});

export const applySeasonLongProjectionCalibrations = (
  projections: readonly ProjectionRecord[],
  inputs: readonly SeasonLongProjectionInput[],
  scoring: SeasonProjectionScoring,
): ProjectionRecord[] => {
  const inputsByPlayer = new Map(
    inputs.map(input => [normalizePlayerName(input.player), input]),
  );

  return projections.map(projection => {
    const input = inputsByPlayer.get(normalizePlayerName(projection.name));
    if (input === undefined) return projection;
    if (input.position !== projection.position) {
      throw new Error(
        `${input.player} season-long projection is ${input.position}, but the player catalog is ${projection.position}.`,
      );
    }
    const baseline = projection.seasonProjection;
    if (baseline === undefined || baseline <= 0) {
      throw new Error(`${projection.name} needs a positive baseline season projection for calibration.`);
    }

    const breakdown = fantasyPointsForSeasonStatLine(input.stats, scoring);
    const projectionCalibration = calibrationFor(baseline, input, scoring, breakdown);
    const weeks = Object.fromEntries(
      Object.entries(projection.weeks).map(([week, points]) => [
        Number(week),
        points * projectionCalibration.weeklyScaleFactor,
      ]),
    );

    return {
      ...projection,
      weeks,
      weeks1To4: [1, 2, 3, 4].reduce((sum, week) => sum + (weeks[week] ?? 0), 0),
      seasonProjection: projectionCalibration.calibratedSeasonProjection,
      projectionCalibration,
    };
  });
};
