import type { Position } from "../../../config/league.js";
import type {
  LiveDraftRoomBoardPlayer,
  LiveDraftRoomIncompleteTeam,
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPickSelection,
  LiveDraftRoomSale,
} from "../liveDraftRooms.js";
import {
  arrayValue,
  numberValue,
  optionalNumberValue,
  optionalStringValue,
  recordValue,
  stringValue,
} from "./json.js";

const positionValue = (value: unknown): Position => {
  if (value === "QB" || value === "RB" || value === "WR" || value === "TE"
    || value === "K" || value === "DST") return value;
  throw new Error("Postgres draft room event payload was malformed.");
};

const sourceValue = (
  value: unknown,
): LiveDraftRoomInitialRosterPlayer["source"] => {
  if (value === undefined || value === "keeper" || value === "imported") return value;
  throw new Error("Postgres draft room event payload was malformed.");
};

export const saleValue = (value: unknown): LiveDraftRoomSale => {
  const sale = recordValue(value);
  return {
    saleEventId: stringValue(sale.saleEventId),
    input: stringValue(sale.input),
    teamId: stringValue(sale.teamId),
    ownerId: stringValue(sale.ownerId),
    ownerDisplayName: stringValue(sale.ownerDisplayName),
    teamDisplayName: stringValue(sale.teamDisplayName),
    playerName: stringValue(sale.playerName),
    normalizedPlayerName: stringValue(sale.normalizedPlayerName),
    position: positionValue(sale.position),
    price: numberValue(sale.price),
    expectedPrice: numberValue(sale.expectedPrice),
    teamAbbreviation: optionalStringValue(sale.teamAbbreviation),
    byeWeek: optionalNumberValue(sale.byeWeek),
  };
};

export const pickValue = (value: unknown): LiveDraftRoomPickSelection => {
  const pick = recordValue(value);
  return {
    pickEventId: stringValue(pick.pickEventId),
    input: stringValue(pick.input),
    overall: numberValue(pick.overall),
    round: numberValue(pick.round),
    pickInRound: numberValue(pick.pickInRound),
    teamId: stringValue(pick.teamId),
    ownerId: stringValue(pick.ownerId),
    ownerDisplayName: stringValue(pick.ownerDisplayName),
    teamDisplayName: stringValue(pick.teamDisplayName),
    playerName: stringValue(pick.playerName),
    normalizedPlayerName: stringValue(pick.normalizedPlayerName),
    position: positionValue(pick.position),
    expectedPrice: numberValue(pick.expectedPrice),
    teamAbbreviation: optionalStringValue(pick.teamAbbreviation),
    byeWeek: optionalNumberValue(pick.byeWeek),
  };
};

const initialRosterValue = (value: unknown): LiveDraftRoomInitialRosterPlayer => {
  const player = recordValue(value);
  return {
    teamId: stringValue(player.teamId),
    playerId: optionalStringValue(player.playerId),
    playerName: stringValue(player.playerName),
    position: positionValue(player.position),
    price: numberValue(player.price),
    keeperRound: optionalNumberValue(player.keeperRound),
    expectedPrice: optionalNumberValue(player.expectedPrice),
    source: sourceValue(player.source),
  };
};

const boardPlayerValue = (value: unknown): LiveDraftRoomBoardPlayer => {
  const player = recordValue(value);
  return {
    name: stringValue(player.name),
    normalizedPlayerName: stringValue(player.normalizedPlayerName),
    position: positionValue(player.position),
    expectedPrice: numberValue(player.expectedPrice),
    marketPrice: optionalNumberValue(player.marketPrice),
    teamAbbreviation: optionalStringValue(player.teamAbbreviation),
    byeWeek: optionalNumberValue(player.byeWeek),
  };
};

const incompleteTeamValue = (value: unknown): LiveDraftRoomIncompleteTeam => {
  const team = recordValue(value);
  return {
    teamId: stringValue(team.teamId),
    ownerDisplayName: stringValue(team.ownerDisplayName),
    teamDisplayName: stringValue(team.teamDisplayName),
    openRosterSlots: numberValue(team.openRosterSlots),
  };
};

export const initialRostersValue = (
  value: unknown,
): readonly LiveDraftRoomInitialRosterPlayer[] => arrayValue(value).map(initialRosterValue);

export const playerCatalogValue = (
  value: unknown,
): readonly LiveDraftRoomBoardPlayer[] => arrayValue(value).map(boardPlayerValue);

export const incompleteTeamsValue = (
  value: unknown,
): readonly LiveDraftRoomIncompleteTeam[] => value === undefined
  ? []
  : arrayValue(value).map(incompleteTeamValue);
