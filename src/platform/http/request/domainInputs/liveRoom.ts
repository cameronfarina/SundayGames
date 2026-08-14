import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
  LiveDraftRoomSaleCommandInput,
  ParsedLiveDraftRoomSaleInput,
} from "../../../liveDraftRooms.js";
import {
  arrayValue,
  optionalNumber,
  optionalString,
  stringValue,
  unknownRecord,
} from "../values.js";
import { isPosition } from "./positions.js";

const saleInputFor = (value: unknown): ParsedLiveDraftRoomSaleInput => {
  const record = unknownRecord(value) ?? {};
  const ownerText = optionalString(record.ownerText);
  const ownerId = optionalString(record.ownerId);
  const teamId = optionalString(record.teamId);
  const teamName = optionalString(record.teamName);
  return {
    playerName: stringValue(record.playerName),
    price: optionalNumber(record.price) ?? Number.NaN,
    ...(ownerText === undefined ? {} : { ownerText }),
    ...(ownerId === undefined ? {} : { ownerId }),
    ...(teamId === undefined ? {} : { teamId }),
    ...(teamName === undefined ? {} : { teamName }),
  };
};

export const liveDraftSaleInputFor = (
  body: Record<string, unknown>,
): LiveDraftRoomSaleCommandInput => {
  if (typeof body.command === "string") return body.command;
  if (typeof body.sale === "string") return body.sale;
  return saleInputFor(body.structuredSale ?? body.sale);
};

export const playerCatalogEntriesFrom = (
  value: unknown,
): readonly LiveDraftRoomPlayerCatalogEntry[] => arrayValue(value).filter(
  (candidate): candidate is LiveDraftRoomPlayerCatalogEntry => {
    const record = unknownRecord(candidate);
    return record !== null
      && typeof record.name === "string"
      && isPosition(record.position)
      && typeof record.expectedPrice === "number";
  },
);

export const initialRosterPlayersFrom = (
  value: unknown,
): readonly LiveDraftRoomInitialRosterPlayer[] => arrayValue(value).filter(
  (candidate): candidate is LiveDraftRoomInitialRosterPlayer => {
    const record = unknownRecord(candidate);
    return record !== null
      && typeof record.teamId === "string"
      && typeof record.playerName === "string"
      && isPosition(record.position)
      && typeof record.price === "number";
  },
);
