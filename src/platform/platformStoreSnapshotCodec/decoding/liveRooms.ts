import type { AuctionLeagueSeason } from "../../leagueSeason.js";
import type { LiveDraftRoom } from "../../liveDraftRooms.js";
import type { LiveDraftRoomSetup } from "../../liveDraftRoomSetups.js";
import { leagueSeasonValue } from "./league.js";
import {
  boardPlayerValue,
  catalogEntryValue,
  initialRosterPlayerValue,
} from "./liveCatalog.js";
import { liveEventValue } from "./liveEvents.js";
import { projectionValue, roomStatusValue } from "./livePlayers.js";
import {
  arrayValue,
  dateValue,
  integerValue,
  invalidSnapshot,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const auctionSeasonValue = (value: unknown, path: string): AuctionLeagueSeason => {
  const season = leagueSeasonValue(value, path);
  const settings = season.settings;
  if (settings.draftFormat !== "auction") return invalidSnapshot(`${path}.settings.draftFormat`);
  return { ...season, settings };
};

export const liveRoomValue = (value: unknown, path: string): LiveDraftRoom => {
  const record = recordValue(value, path);
  return {
    roomId: stringValue(record.roomId, `${path}.roomId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    status: roomStatusValue(record.status, `${path}.status`),
    commissionerUserId: stringValue(record.commissionerUserId, `${path}.commissionerUserId`),
    startsAt: optionalValue(record.startsAt, `${path}.startsAt`, dateValue),
    viewerPasswordHashRef: stringValue(record.viewerPasswordHashRef, `${path}.viewerPasswordHashRef`),
    revision: integerValue(record.revision, `${path}.revision`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
    endedAt: optionalValue(record.endedAt, `${path}.endedAt`, dateValue),
    season: auctionSeasonValue(record.season, `${path}.season`),
    playerCatalog: arrayValue(record.playerCatalog, `${path}.playerCatalog`, boardPlayerValue),
    initialRosters: arrayValue(record.initialRosters, `${path}.initialRosters`, initialRosterPlayerValue),
    events: arrayValue(record.events, `${path}.events`, liveEventValue),
    projection: projectionValue(record.projection, `${path}.projection`),
  };
};

export const liveRoomSetupValue = (value: unknown, path: string): LiveDraftRoomSetup => {
  const record = recordValue(value, path);
  return {
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    sourceVersion: stringValue(record.sourceVersion, `${path}.sourceVersion`),
    playerCatalog: arrayValue(record.playerCatalog, `${path}.playerCatalog`, catalogEntryValue),
    initialRosters: arrayValue(record.initialRosters, `${path}.initialRosters`, initialRosterPlayerValue),
    contentHash: stringValue(record.contentHash, `${path}.contentHash`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
  };
};
