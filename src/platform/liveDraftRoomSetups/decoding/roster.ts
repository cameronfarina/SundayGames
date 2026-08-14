import type { LiveDraftRoomInitialRosterPlayer } from "../../liveDraftRooms.js";
import {
  invalidStoredSetup,
  numberValue,
  optionalValue,
  positionValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const sourceValue = (
  value: unknown,
  path: string,
): "keeper" | "imported" | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value === "keeper" || value === "imported") return value;
  return invalidStoredSetup(path);
};

export const initialRosterPlayerValue = (
  value: unknown,
  path: string,
): LiveDraftRoomInitialRosterPlayer => {
  const record = recordValue(value, path);
  return {
    teamId: stringValue(record.teamId, `${path}.teamId`),
    playerId: optionalValue(record.playerId, `${path}.playerId`, stringValue),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    position: positionValue(record.position, `${path}.position`),
    price: numberValue(record.price, `${path}.price`),
    keeperRound: optionalValue(record.keeperRound, `${path}.keeperRound`, numberValue),
    expectedPrice: optionalValue(record.expectedPrice, `${path}.expectedPrice`, numberValue),
    source: sourceValue(record.source, `${path}.source`),
  };
};
