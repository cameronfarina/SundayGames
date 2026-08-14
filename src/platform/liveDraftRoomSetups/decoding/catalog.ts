import type { SeasonProjectionScoring } from "../../../modeling/seasonLongProjection.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../liveDraftRooms.js";
import {
  numberValue,
  optionalValue,
  positionValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const scoringValue = (value: unknown, path: string): SeasonProjectionScoring => {
  const record = recordValue(value, path);
  return {
    rushingYards: numberValue(record.rushingYards, `${path}.rushingYards`),
    rushingTouchdown: numberValue(record.rushingTouchdown, `${path}.rushingTouchdown`),
    receivingYards: numberValue(record.receivingYards, `${path}.receivingYards`),
    receivingTouchdown: numberValue(record.receivingTouchdown, `${path}.receivingTouchdown`),
    reception: numberValue(record.reception, `${path}.reception`),
  };
};

export const catalogEntryValue = (
  value: unknown,
  path: string,
): LiveDraftRoomPlayerCatalogEntry => {
  const record = recordValue(value, path);
  return {
    name: stringValue(record.name, `${path}.name`),
    position: positionValue(record.position, `${path}.position`),
    expectedPrice: numberValue(record.expectedPrice, `${path}.expectedPrice`),
    marketPrice: optionalValue(record.marketPrice, `${path}.marketPrice`, numberValue),
    teamAbbreviation: optionalValue(record.teamAbbreviation, `${path}.teamAbbreviation`, stringValue),
    byeWeek: optionalValue(record.byeWeek, `${path}.byeWeek`, numberValue),
    week1Projection: optionalValue(record.week1Projection, `${path}.week1Projection`, numberValue),
    weeks1To4Projection: optionalValue(record.weeks1To4Projection, `${path}.weeks1To4Projection`, numberValue),
    seasonProjection: optionalValue(record.seasonProjection, `${path}.seasonProjection`, numberValue),
    seasonProjectionAdjustmentFactor: optionalValue(
      record.seasonProjectionAdjustmentFactor,
      `${path}.seasonProjectionAdjustmentFactor`,
      numberValue,
    ),
    seasonProjectionScoring: optionalValue(
      record.seasonProjectionScoring,
      `${path}.seasonProjectionScoring`,
      scoringValue,
    ),
  };
};
