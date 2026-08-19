import type { SeasonProjectionScoring } from "../../../modeling/seasonLongProjection.js";
import type {
  LiveDraftRoomBoardPlayer,
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
  LiveDraftRoomRosterPlayer,
} from "../../liveDraftRooms.js";
import { optionalString, positionValue } from "./leaguePrimitives.js";
import {
  numberValue,
  optionalValue,
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
    teamAbbreviation: optionalString(record.teamAbbreviation, `${path}.teamAbbreviation`),
    byeWeek: optionalValue(record.byeWeek, `${path}.byeWeek`, numberValue),
    week1Projection: optionalValue(record.week1Projection, `${path}.week1Projection`, numberValue),
    weeks1To4Projection: optionalValue(record.weeks1To4Projection, `${path}.weeks1To4Projection`, numberValue),
    seasonProjection: optionalValue(record.seasonProjection, `${path}.seasonProjection`, numberValue),
    seasonProjectionAdjustmentFactor: optionalValue(record.seasonProjectionAdjustmentFactor, `${path}.seasonProjectionAdjustmentFactor`, numberValue),
    seasonProjectionScoring: optionalValue(record.seasonProjectionScoring, `${path}.seasonProjectionScoring`, scoringValue),
  };
};

export const initialRosterPlayerValue = (
  value: unknown,
  path: string,
): LiveDraftRoomInitialRosterPlayer => {
  const record = recordValue(value, path);
  const source = record.source;
  if (source !== undefined && source !== null && source !== "keeper" && source !== "imported") {
    throw new Error(`Invalid platform store snapshot at ${path}.source.`);
  }
  return {
    teamId: stringValue(record.teamId, `${path}.teamId`),
    playerId: optionalString(record.playerId, `${path}.playerId`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    position: positionValue(record.position, `${path}.position`),
    price: numberValue(record.price, `${path}.price`),
    keeperRound: optionalValue(record.keeperRound, `${path}.keeperRound`, numberValue),
    expectedPrice: optionalValue(record.expectedPrice, `${path}.expectedPrice`, numberValue),
    source: source === null ? undefined : source,
  };
};

export const boardPlayerValue = (value: unknown, path: string): LiveDraftRoomBoardPlayer => {
  const record = recordValue(value, path);
  return {
    name: stringValue(record.name, `${path}.name`),
    normalizedPlayerName: stringValue(record.normalizedPlayerName, `${path}.normalizedPlayerName`),
    position: positionValue(record.position, `${path}.position`),
    expectedPrice: numberValue(record.expectedPrice, `${path}.expectedPrice`),
    marketPrice: optionalValue(record.marketPrice, `${path}.marketPrice`, numberValue),
    teamAbbreviation: optionalString(record.teamAbbreviation, `${path}.teamAbbreviation`),
    byeWeek: optionalValue(record.byeWeek, `${path}.byeWeek`, numberValue),
  };
};

export const rosterPlayerValue = (value: unknown, path: string): LiveDraftRoomRosterPlayer => {
  const record = recordValue(value, path);
  const source = record.source;
  if (source !== "keeper" && source !== "imported" && source !== "sale" && source !== "pick") {
    throw new Error(`Invalid platform store snapshot at ${path}.source.`);
  }
  return {
    name: stringValue(record.name, `${path}.name`),
    normalizedPlayerName: stringValue(record.normalizedPlayerName, `${path}.normalizedPlayerName`),
    position: positionValue(record.position, `${path}.position`),
    price: numberValue(record.price, `${path}.price`),
    expectedPrice: numberValue(record.expectedPrice, `${path}.expectedPrice`),
    source,
    saleEventId: optionalString(record.saleEventId, `${path}.saleEventId`),
    pickEventId: optionalString(record.pickEventId, `${path}.pickEventId`),
    teamAbbreviation: optionalString(record.teamAbbreviation, `${path}.teamAbbreviation`),
    byeWeek: optionalValue(record.byeWeek, `${path}.byeWeek`, numberValue),
  };
};
