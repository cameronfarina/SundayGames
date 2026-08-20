import type {
  LiveDraftRoomProjection,
  LiveDraftRoomRosterSlot,
  LiveDraftRoomSale,
  LiveDraftRoomStatus,
  LiveDraftRoomTeamState,
} from "../../liveDraftRooms.js";
import { optionalString, positionValue } from "./leaguePrimitives.js";
import { boardPlayerValue, rosterPlayerValue } from "./liveCatalog.js";
import {
  arrayValue,
  dateValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

export const roomStatusValue = (value: unknown, path: string): LiveDraftRoomStatus => {
  if (value === "setup" || value === "countdown" || value === "live"
    || value === "paused" || value === "ended") return value;
  return invalidSnapshot(path);
};

export const saleValue = (value: unknown, path: string): LiveDraftRoomSale => {
  const record = recordValue(value, path);
  const price = optionalValue(record.price, `${path}.price`, numberValue);
  return {
    saleEventId: stringValue(record.saleEventId, `${path}.saleEventId`),
    input: stringValue(record.input, `${path}.input`),
    teamId: stringValue(record.teamId, `${path}.teamId`),
    ownerId: stringValue(record.ownerId, `${path}.ownerId`),
    ownerDisplayName: stringValue(record.ownerDisplayName, `${path}.ownerDisplayName`),
    teamDisplayName: stringValue(record.teamDisplayName, `${path}.teamDisplayName`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    normalizedPlayerName: stringValue(record.normalizedPlayerName, `${path}.normalizedPlayerName`),
    position: positionValue(record.position, `${path}.position`),
    ...(price === undefined ? {} : { price }),
    expectedPrice: numberValue(record.expectedPrice, `${path}.expectedPrice`),
    teamAbbreviation: optionalString(record.teamAbbreviation, `${path}.teamAbbreviation`),
    byeWeek: optionalValue(record.byeWeek, `${path}.byeWeek`, numberValue),
  };
};

const slotValue = (value: unknown, path: string): LiveDraftRoomRosterSlot => {
  const record = recordValue(value, path);
  return {
    slot: stringValue(record.slot, `${path}.slot`),
    player: optionalValue(record.player, `${path}.player`, rosterPlayerValue),
  };
};

const positionCountsValue = (value: unknown, path: string) => {
  const record = recordValue(value, path);
  return {
    QB: integerValue(record.QB, `${path}.QB`),
    RB: integerValue(record.RB, `${path}.RB`),
    WR: integerValue(record.WR, `${path}.WR`),
    TE: integerValue(record.TE, `${path}.TE`),
    K: integerValue(record.K, `${path}.K`),
    DST: integerValue(record.DST, `${path}.DST`),
  };
};

const teamStateValue = (value: unknown, path: string): LiveDraftRoomTeamState => {
  const record = recordValue(value, path);
  const budgetDollars = optionalValue(record.budgetDollars, `${path}.budgetDollars`, numberValue);
  const spent = optionalValue(record.spent, `${path}.spent`, numberValue);
  const budgetRemaining = optionalValue(record.budgetRemaining, `${path}.budgetRemaining`, numberValue);
  const maxBid = optionalValue(record.maxBid, `${path}.maxBid`, numberValue);
  return {
    teamId: stringValue(record.teamId, `${path}.teamId`),
    ownerId: stringValue(record.ownerId, `${path}.ownerId`),
    ownerDisplayName: stringValue(record.ownerDisplayName, `${path}.ownerDisplayName`),
    teamDisplayName: stringValue(record.teamDisplayName, `${path}.teamDisplayName`),
    draftOrderPosition: integerValue(record.draftOrderPosition, `${path}.draftOrderPosition`),
    ...(budgetDollars === undefined ? {} : { budgetDollars }),
    ...(spent === undefined ? {} : { spent }),
    ...(budgetRemaining === undefined ? {} : { budgetRemaining }),
    rosterSlotsRemaining: integerValue(record.rosterSlotsRemaining, `${path}.rosterSlotsRemaining`),
    ...(maxBid === undefined ? {} : { maxBid }),
    positionCounts: positionCountsValue(record.positionCounts, `${path}.positionCounts`),
    roster: arrayValue(record.roster, `${path}.roster`, rosterPlayerValue),
    slots: arrayValue(record.slots, `${path}.slots`, slotValue),
  };
};

export const projectionValue = (value: unknown, path: string): LiveDraftRoomProjection => {
  const record = recordValue(value, path);
  return {
    roomId: stringValue(record.roomId, `${path}.roomId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    status: roomStatusValue(record.status, `${path}.status`),
    revision: integerValue(record.revision, `${path}.revision`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
    teams: arrayValue(record.teams, `${path}.teams`, teamStateValue),
    board: arrayValue(record.board, `${path}.board`, boardPlayerValue),
    sales: arrayValue(record.sales, `${path}.sales`, saleValue),
  };
};
