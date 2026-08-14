import type {
  LiveDraftRoomEvent,
  LiveDraftRoomIncompleteTeam,
} from "../../liveDraftRooms.js";
import { boardPlayerValue, initialRosterPlayerValue } from "./liveCatalog.js";
import { saleValue } from "./livePlayers.js";
import { optionalString } from "./leaguePrimitives.js";
import {
  arrayValue,
  booleanValue,
  dateValue,
  integerValue,
  invalidSnapshot,
  recordValue,
  stringValue,
} from "./primitives.js";

const incompleteTeamValue = (value: unknown, path: string): LiveDraftRoomIncompleteTeam => {
  const record = recordValue(value, path);
  return {
    teamId: stringValue(record.teamId, `${path}.teamId`),
    ownerDisplayName: stringValue(record.ownerDisplayName, `${path}.ownerDisplayName`),
    teamDisplayName: stringValue(record.teamDisplayName, `${path}.teamDisplayName`),
    openRosterSlots: integerValue(record.openRosterSlots, `${path}.openRosterSlots`),
  };
};

const eventBase = (record: Record<string, unknown>, path: string) => ({
  id: stringValue(record.id, `${path}.id`),
  roomId: stringValue(record.roomId, `${path}.roomId`),
  leagueId: stringValue(record.leagueId, `${path}.leagueId`),
  seasonId: stringValue(record.seasonId, `${path}.seasonId`),
  revision: integerValue(record.revision, `${path}.revision`),
  actorUserId: stringValue(record.actorUserId, `${path}.actorUserId`),
  occurredAt: dateValue(record.occurredAt, `${path}.occurredAt`),
  idempotencyKey: optionalString(record.idempotencyKey, `${path}.idempotencyKey`),
  mutationHash: optionalString(record.mutationHash, `${path}.mutationHash`),
});

export const liveEventValue = (value: unknown, path: string): LiveDraftRoomEvent => {
  const record = recordValue(value, path);
  const base = eventBase(record, path);
  switch (record.type) {
    case "room_created":
    case "room_paused":
    case "room_resumed":
    case "room_started":
    case "room_reopened":
      return { ...base, type: record.type };
    case "initial_rosters_synchronized":
      return {
        ...base,
        type: record.type,
        idempotencyKey: stringValue(record.idempotencyKey, `${path}.idempotencyKey`),
        mutationHash: stringValue(record.mutationHash, `${path}.mutationHash`),
        initialRosters: arrayValue(record.initialRosters, `${path}.initialRosters`, initialRosterPlayerValue),
        playerCatalog: arrayValue(record.playerCatalog, `${path}.playerCatalog`, boardPlayerValue),
      };
    case "sale_logged":
      return { ...base, type: record.type, sale: saleValue(record.sale, `${path}.sale`) };
    case "sale_corrected":
      return {
        ...base,
        type: record.type,
        correctedSaleEventId: stringValue(record.correctedSaleEventId, `${path}.correctedSaleEventId`),
        previousSale: saleValue(record.previousSale, `${path}.previousSale`),
        replacementSale: saleValue(record.replacementSale, `${path}.replacementSale`),
      };
    case "sale_undone":
      return {
        ...base,
        type: record.type,
        undoneSaleEventId: stringValue(record.undoneSaleEventId, `${path}.undoneSaleEventId`),
        undoneSale: saleValue(record.undoneSale, `${path}.undoneSale`),
      };
    case "room_ended":
      return {
        ...base,
        type: record.type,
        incomplete: booleanValue(record.incomplete, `${path}.incomplete`),
        incompleteTeams: arrayValue(record.incompleteTeams, `${path}.incompleteTeams`, incompleteTeamValue),
      };
    default:
      return invalidSnapshot(`${path}.type`);
  }
};
