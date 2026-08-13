import fs from "node:fs/promises";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../projections.js";

export interface SeasonProjectionScoring {
  rushingYards: number;
  rushingTouchdown: number;
  receivingYards: number;
  receivingTouchdown: number;
  reception: number;
}

export interface RushingReceivingSeasonStatLine {
  rushingYards: number;
  rushingTouchdowns: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
}

export interface SeasonLongProjectionInput {
  player: string;
  position: "RB";
  provider: string;
  sourceDate: string;
  sourceUrl: string;
  sourceUrls?: readonly string[] | undefined;
  sourceDescription: string;
  stats: RushingReceivingSeasonStatLine;
}

export interface SeasonProjectionScoringBreakdown {
  rushingYards: number;
  rushingTouchdowns: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  total: number;
}

export interface SeasonLongProjectionCalibration {
  basis: "season-long stat line";
  provider: string;
  sourceDate: string;
  sourceUrl: string;
  sourceUrls: readonly string[];
  sourceDescription: string;
  baselineSeasonProjection: number;
  calibratedSeasonProjection: number;
  weeklyScaleFactor: number;
  scoring: SeasonProjectionScoring;
  statLine: RushingReceivingSeasonStatLine;
  scoringBreakdown: SeasonProjectionScoringBreakdown;
}

interface SeasonLongProjectionDocument {
  schemaVersion: 1;
  season: number;
  projections: readonly SeasonLongProjectionInput[];
}

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const assertNonNegativeFiniteNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a non-negative finite number.`);
  }

  return value;
};

const assertNonEmptyString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value.trim();
};

const assertNonEmptyStringArray = (value: unknown, path: string): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array.`);
  }

  return value.map((item, index) => assertNonEmptyString(item, `${path}[${index}]`));
};

export const fantasyPointsForSeasonStatLine = (
  stats: RushingReceivingSeasonStatLine,
  scoring: SeasonProjectionScoring,
): SeasonProjectionScoringBreakdown => {
  const breakdown = {
    rushingYards: roundToTwo(stats.rushingYards * scoring.rushingYards),
    rushingTouchdowns: roundToTwo(stats.rushingTouchdowns * scoring.rushingTouchdown),
    receptions: roundToTwo(stats.receptions * scoring.reception),
    receivingYards: roundToTwo(stats.receivingYards * scoring.receivingYards),
    receivingTouchdowns: roundToTwo(stats.receivingTouchdowns * scoring.receivingTouchdown),
  };

  return {
    ...breakdown,
    total: roundToTwo(Object.values(breakdown).reduce((sum, value) => sum + value, 0)),
  };
};

const calibrationFor = (
  baselineSeasonProjection: number,
  input: SeasonLongProjectionInput,
  scoring: SeasonProjectionScoring,
  scoringBreakdown: SeasonProjectionScoringBreakdown,
): SeasonLongProjectionCalibration => ({
  basis: "season-long stat line",
  provider: input.provider,
  sourceDate: input.sourceDate,
  sourceUrl: input.sourceUrl,
  sourceUrls: input.sourceUrls ?? [input.sourceUrl],
  sourceDescription: input.sourceDescription,
  baselineSeasonProjection,
  calibratedSeasonProjection: scoringBreakdown.total,
  weeklyScaleFactor: scoringBreakdown.total / baselineSeasonProjection,
  scoring: { ...scoring },
  statLine: input.stats,
  scoringBreakdown,
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
    if (projection.seasonProjection === undefined || projection.seasonProjection <= 0) {
      throw new Error(`${projection.name} needs a positive baseline season projection for calibration.`);
    }

    const scoringBreakdown = fantasyPointsForSeasonStatLine(input.stats, scoring);
    const projectionCalibration = calibrationFor(
      projection.seasonProjection,
      input,
      scoring,
      scoringBreakdown,
    );
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

export const loadSeasonLongProjectionInputs = async (
  path: string,
): Promise<readonly SeasonLongProjectionInput[]> => {
  const parsed = JSON.parse(await fs.readFile(path, "utf8")) as Partial<SeasonLongProjectionDocument>;
  if (parsed.schemaVersion !== 1) {
    throw new Error("Season-long projection document must use schemaVersion 1.");
  }
  assertNonNegativeFiniteNumber(parsed.season, "season");
  if (!Array.isArray(parsed.projections)) {
    throw new Error("Season-long projection document must include a projections array.");
  }

  return parsed.projections.map((input, index) => {
    const pathPrefix = `projections[${index}]`;
    if (input.position !== "RB") {
      throw new Error(`${pathPrefix}.position must be RB in the current proof of concept.`);
    }

    return {
      player: assertNonEmptyString(input.player, `${pathPrefix}.player`),
      position: input.position,
      provider: assertNonEmptyString(input.provider, `${pathPrefix}.provider`),
      sourceDate: assertNonEmptyString(input.sourceDate, `${pathPrefix}.sourceDate`),
      sourceUrl: assertNonEmptyString(input.sourceUrl, `${pathPrefix}.sourceUrl`),
      sourceUrls: input.sourceUrls === undefined
        ? undefined
        : assertNonEmptyStringArray(input.sourceUrls, `${pathPrefix}.sourceUrls`),
      sourceDescription: assertNonEmptyString(
        input.sourceDescription,
        `${pathPrefix}.sourceDescription`,
      ),
      stats: {
        rushingYards: assertNonNegativeFiniteNumber(
          input.stats?.rushingYards,
          `${pathPrefix}.stats.rushingYards`,
        ),
        rushingTouchdowns: assertNonNegativeFiniteNumber(
          input.stats?.rushingTouchdowns,
          `${pathPrefix}.stats.rushingTouchdowns`,
        ),
        receptions: assertNonNegativeFiniteNumber(
          input.stats?.receptions,
          `${pathPrefix}.stats.receptions`,
        ),
        receivingYards: assertNonNegativeFiniteNumber(
          input.stats?.receivingYards,
          `${pathPrefix}.stats.receivingYards`,
        ),
        receivingTouchdowns: assertNonNegativeFiniteNumber(
          input.stats?.receivingTouchdowns,
          `${pathPrefix}.stats.receivingTouchdowns`,
        ),
      },
    };
  });
};
