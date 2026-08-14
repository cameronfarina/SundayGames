import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups.js";
import { catalogValue } from "./catalog.js";
import { invalidWorkerMessage } from "./errors.js";
import {
  arrayValue,
  dateValue,
  numberValue,
  optionalNumberValue,
  optionalStringValue,
  positionValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const rosterPlayerValue = (value: unknown): LiveDraftRoomInitialRosterPlayer => {
  const record = recordValue(value);
  const playerId = optionalStringValue(record.playerId);
  const keeperRound = optionalNumberValue(record.keeperRound);
  const expectedPrice = optionalNumberValue(record.expectedPrice);
  const source = record.source;
  if (source !== undefined && source !== "keeper" && source !== "imported") {
    return invalidWorkerMessage();
  }
  return {
    teamId: stringValue(record.teamId),
    ...(playerId === undefined ? {} : { playerId }),
    playerName: stringValue(record.playerName),
    position: positionValue(record.position),
    price: numberValue(record.price),
    ...(keeperRound === undefined ? {} : { keeperRound }),
    ...(expectedPrice === undefined ? {} : { expectedPrice }),
    ...(source === undefined ? {} : { source }),
  };
};

export const setupValue = (value: unknown): LiveDraftRoomSetup => {
  const record = recordValue(value);
  return {
    seasonId: stringValue(record.seasonId),
    sourceVersion: stringValue(record.sourceVersion),
    playerCatalog: catalogValue(record.playerCatalog),
    initialRosters: arrayValue(record.initialRosters).map(rosterPlayerValue),
    contentHash: stringValue(record.contentHash),
    updatedAt: dateValue(record.updatedAt),
  };
};
