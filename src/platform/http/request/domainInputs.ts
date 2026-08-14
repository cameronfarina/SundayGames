import type { Position } from "../../../../config/league.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
  LiveDraftRoomSaleCommandInput,
  ParsedLiveDraftRoomSaleInput,
} from "../../liveDraftRooms.js";
import type {
  MockDraftMetadataValue,
  MockDraftModeMetadata,
  MockDraftResultReference,
} from "../../mockSessions.js";
import type { PlatformLeagueMembership } from "../../platformApp.js";
import type { LeagueSeason } from "../../leagueSeason.js";
import type { PricingSourcePrice } from "../../pricingSnapshots.js";
import {
  arrayValue,
  isUnknownRecord,
  optionalNumber,
  optionalString,
  stringValue,
  unknownRecord,
} from "./values.js";

const isPosition = (value: unknown): value is Position =>
  value === "QB" || value === "RB" || value === "WR" || value === "TE" || value === "K" || value === "DST";

export const mockDraftResultReferenceFor = (
  value: unknown,
): MockDraftResultReference | undefined => {
  const record = unknownRecord(value);
  const id = optionalString(record?.id);
  const kind = optionalString(record?.kind);
  if (id === undefined || (kind !== "mock-result" && kind !== "simulation-result")) return undefined;
  const label = optionalString(record?.label);
  return { id, kind, ...(label === undefined ? {} : { label }) };
};

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

const metadataValueFor = (value: unknown): MockDraftMetadataValue | undefined => {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const entries = value.map(metadataValueFor);
    return entries.some(entry => entry === undefined) ? undefined : entries.filter(entry => entry !== undefined);
  }
  if (!isUnknownRecord(value)) return undefined;
  const result: Record<string, MockDraftMetadataValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = metadataValueFor(entry);
    if (parsed === undefined) return undefined;
    result[key] = parsed;
  }
  return result;
};

export const mockDraftModeMetadataFor = (value: unknown): MockDraftModeMetadata => {
  const record = unknownRecord(value) ?? {};
  const format = record.format === "snake" ? "snake" : "auction";
  const label = optionalString(record.label);
  const settings = metadataValueFor(record.settings);
  return {
    format,
    mockCount: optionalNumber(record.mockCount) ?? Number.NaN,
    ...(label === undefined ? {} : { label }),
    ...(settings === undefined || !isUnknownRecord(settings) ? {} : { settings }),
  };
};

export const pricingSourcePricesFrom = (value: unknown): readonly PricingSourcePrice[] =>
  arrayValue(value).flatMap(candidate => {
    const record = unknownRecord(candidate);
    if (record === null || !isPosition(record.position)) return [];
    return [{
      name: stringValue(record.name),
      normalizedName: stringValue(record.normalizedName),
      position: record.position,
      price: optionalNumber(record.price) ?? Number.NaN,
    }];
  });

export const isLeagueSeason = (value: unknown): value is LeagueSeason => {
  const record = unknownRecord(value);
  return record !== null
    && typeof record.id === "string"
    && typeof record.leagueId === "string"
    && typeof record.seasonYear === "number"
    && isUnknownRecord(record.league)
    && isUnknownRecord(record.settings)
    && Array.isArray(record.teams);
};

export const platformLeagueMembershipsFrom = (
  value: unknown,
): readonly PlatformLeagueMembership[] => arrayValue(value).flatMap(candidate => {
  const record = unknownRecord(candidate);
  if (record === null) return [];
  const role = record.role;
  if (role !== "owner" && role !== "admin" && role !== "member" && role !== "observer") return [];
  const ownerId = optionalString(record.ownerId);
  const teamId = optionalString(record.teamId);
  const inviteEmail = optionalString(record.inviteEmail);
  return [{
    userId: stringValue(record.userId),
    leagueId: stringValue(record.leagueId),
    role,
    ...(ownerId === undefined ? {} : { ownerId }),
    ...(teamId === undefined ? {} : { teamId }),
    ...(inviteEmail === undefined ? {} : { inviteEmail }),
  }];
});

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
