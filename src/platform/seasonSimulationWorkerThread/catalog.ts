import type { SeasonProjectionScoring } from "../../modeling/seasonLongProjection.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../liveDraftRooms.js";
import {
  arrayValue,
  numberValue,
  numberRecordValue,
  optionalNumberValue,
  optionalStringValue,
  positionValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const scoringValue = (value: unknown): SeasonProjectionScoring => {
  const record = recordValue(value);
  return {
    ...numberRecordValue(record),
    rushingYards: numberValue(record.rushingYards),
    rushingTouchdown: numberValue(record.rushingTouchdown),
    receivingYards: numberValue(record.receivingYards),
    receivingTouchdown: numberValue(record.receivingTouchdown),
    reception: numberValue(record.reception),
  };
};

const optionalScoringValue = (
  value: unknown,
): SeasonProjectionScoring | undefined =>
  value === undefined ? undefined : scoringValue(value);

const catalogEntryValue = (value: unknown): LiveDraftRoomPlayerCatalogEntry => {
  const record = recordValue(value);
  const marketPrice = optionalNumberValue(record.marketPrice);
  const teamAbbreviation = optionalStringValue(record.teamAbbreviation);
  const byeWeek = optionalNumberValue(record.byeWeek);
  const week1Projection = optionalNumberValue(record.week1Projection);
  const weeks1To4Projection = optionalNumberValue(record.weeks1To4Projection);
  const seasonProjection = optionalNumberValue(record.seasonProjection);
  const adjustment = optionalNumberValue(record.seasonProjectionAdjustmentFactor);
  const scoring = optionalScoringValue(record.seasonProjectionScoring);
  return {
    name: stringValue(record.name),
    position: positionValue(record.position),
    expectedPrice: numberValue(record.expectedPrice),
    ...(marketPrice === undefined ? {} : { marketPrice }),
    ...(teamAbbreviation === undefined ? {} : { teamAbbreviation }),
    ...(byeWeek === undefined ? {} : { byeWeek }),
    ...(week1Projection === undefined ? {} : { week1Projection }),
    ...(weeks1To4Projection === undefined ? {} : { weeks1To4Projection }),
    ...(seasonProjection === undefined ? {} : { seasonProjection }),
    ...(adjustment === undefined ? {} : { seasonProjectionAdjustmentFactor: adjustment }),
    ...(scoring === undefined ? {} : { seasonProjectionScoring: scoring }),
  };
};

export const catalogValue = (value: unknown): readonly LiveDraftRoomPlayerCatalogEntry[] =>
  arrayValue(value).map(catalogEntryValue);
