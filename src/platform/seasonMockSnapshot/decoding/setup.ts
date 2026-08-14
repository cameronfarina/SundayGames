import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../../liveDraftRooms.js";
import type { SeasonMockSetupSnapshot } from "../contracts.js";
import { malformedSnapshot } from "../errors.js";
import {
  arrayValue,
  dateString,
  finiteNumber,
  nonEmptyString,
  optionalFiniteNumber,
  optionalString,
  plainRecord,
  positionValue,
  positiveInteger,
} from "./primitives.js";

const catalogEntryValue = (value: unknown): LiveDraftRoomPlayerCatalogEntry => {
  const record = plainRecord(value);
  const marketPrice = optionalFiniteNumber(record.marketPrice);
  const teamAbbreviation = optionalString(record.teamAbbreviation);
  const byeWeek = record.byeWeek === undefined ? undefined : positiveInteger(record.byeWeek);
  const week1Projection = optionalFiniteNumber(record.week1Projection);
  const weeks1To4Projection = optionalFiniteNumber(record.weeks1To4Projection);
  const seasonProjection = optionalFiniteNumber(record.seasonProjection);
  return {
    name: nonEmptyString(record.name),
    position: positionValue(record.position),
    expectedPrice: finiteNumber(record.expectedPrice),
    ...(marketPrice === undefined ? {} : { marketPrice }),
    ...(teamAbbreviation === undefined ? {} : { teamAbbreviation }),
    ...(byeWeek === undefined ? {} : { byeWeek }),
    ...(week1Projection === undefined ? {} : { week1Projection }),
    ...(weeks1To4Projection === undefined ? {} : { weeks1To4Projection }),
    ...(seasonProjection === undefined ? {} : { seasonProjection }),
  };
};

const initialRosterPlayerValue = (value: unknown): LiveDraftRoomInitialRosterPlayer => {
  const record = plainRecord(value);
  const playerId = optionalString(record.playerId);
  const keeperRound = record.keeperRound === undefined
    ? undefined
    : positiveInteger(record.keeperRound);
  const expectedPrice = optionalFiniteNumber(record.expectedPrice);
  const source = record.source;
  if (source !== undefined && source !== "keeper" && source !== "imported") {
    return malformedSnapshot();
  }
  return {
    teamId: nonEmptyString(record.teamId),
    ...(playerId === undefined ? {} : { playerId }),
    playerName: nonEmptyString(record.playerName),
    position: positionValue(record.position),
    price: finiteNumber(record.price),
    ...(keeperRound === undefined ? {} : { keeperRound }),
    ...(expectedPrice === undefined ? {} : { expectedPrice }),
    ...(source === undefined ? {} : { source }),
  };
};

export const setupValue = (value: unknown): SeasonMockSetupSnapshot => {
  const record = plainRecord(value);
  return {
    seasonId: nonEmptyString(record.seasonId),
    sourceVersion: nonEmptyString(record.sourceVersion),
    playerCatalog: arrayValue(record.playerCatalog).map(catalogEntryValue),
    initialRosters: arrayValue(record.initialRosters).map(initialRosterPlayerValue),
    contentHash: nonEmptyString(record.contentHash),
    updatedAt: dateString(record.updatedAt),
  };
};
