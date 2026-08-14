import type { SeasonLongProjectionInput } from "./contracts.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonNegativeNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a non-negative finite number.`);
  }
  return value;
};

const nonEmptyString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value.trim();
};

const sourceUrlsFor = (value: unknown, path: string): readonly string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array.`);
  }
  return value.map((item, index) => nonEmptyString(item, `${path}[${index}]`));
};

export const seasonLongProjectionInputFor = (
  value: unknown,
  index: number,
): SeasonLongProjectionInput => {
  const prefix = `projections[${index}]`;
  const input = isRecord(value) ? value : {};
  if (input.position !== "RB") {
    throw new Error(`${prefix}.position must be RB in the current proof of concept.`);
  }
  const stats = isRecord(input.stats) ? input.stats : {};

  return {
    player: nonEmptyString(input.player, `${prefix}.player`),
    position: input.position,
    provider: nonEmptyString(input.provider, `${prefix}.provider`),
    sourceDate: nonEmptyString(input.sourceDate, `${prefix}.sourceDate`),
    sourceUrl: nonEmptyString(input.sourceUrl, `${prefix}.sourceUrl`),
    sourceUrls: sourceUrlsFor(input.sourceUrls, `${prefix}.sourceUrls`),
    sourceDescription: nonEmptyString(input.sourceDescription, `${prefix}.sourceDescription`),
    stats: {
      rushingYards: nonNegativeNumber(stats.rushingYards, `${prefix}.stats.rushingYards`),
      rushingTouchdowns: nonNegativeNumber(
        stats.rushingTouchdowns,
        `${prefix}.stats.rushingTouchdowns`,
      ),
      receptions: nonNegativeNumber(stats.receptions, `${prefix}.stats.receptions`),
      receivingYards: nonNegativeNumber(stats.receivingYards, `${prefix}.stats.receivingYards`),
      receivingTouchdowns: nonNegativeNumber(
        stats.receivingTouchdowns,
        `${prefix}.stats.receivingTouchdowns`,
      ),
    },
  };
};

export const seasonLongProjectionDocumentFor = (
  value: unknown,
): readonly SeasonLongProjectionInput[] => {
  const document = isRecord(value) ? value : {};
  if (document.schemaVersion !== 1) {
    throw new Error("Season-long projection document must use schemaVersion 1.");
  }
  nonNegativeNumber(document.season, "season");
  if (!Array.isArray(document.projections)) {
    throw new Error("Season-long projection document must include a projections array.");
  }
  return document.projections.map(seasonLongProjectionInputFor);
};
