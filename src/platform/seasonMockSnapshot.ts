import { positions, type Position } from "../../config/league.js";
import {
  normalizeLeagueSeasonSettings,
  type ExplicitLeagueSeasonSettings,
  type FantasyTeam,
  type League,
  type LeagueSeason,
  type LeagueSeasonDraftSchedule,
  type LeagueSeasonSetupStatus,
  type ScoringSettings,
} from "./leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./liveDraftRooms.js";
import type { LiveDraftRoomSetup } from "./liveDraftRoomSetups.js";

export const seasonMockConfigurationSnapshotMaxBytes = 2 * 1024 * 1024;

const snapshotSchema = "mockd-season-mock" as const;
const snapshotVersion = 2 as const;
const snapshotStorageLimitLabel = "2 MiB";

export type SeasonMockConfigurationSnapshotErrorCode =
  | "snapshot_malformed"
  | "snapshot_migration_required"
  | "snapshot_too_large";

export class SeasonMockConfigurationSnapshotError extends Error {
  constructor(
    readonly code: SeasonMockConfigurationSnapshotErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonMockConfigurationSnapshotError";
  }
}

export interface SeasonMockSetupSnapshot extends Omit<LiveDraftRoomSetup, "updatedAt"> {
  updatedAt: string;
}

export interface SeasonMockConfigurationSnapshotPayloadV2 {
  season: LeagueSeason<ExplicitLeagueSeasonSettings>;
  setup: SeasonMockSetupSnapshot;
  humanTeamId: string;
  playerExpectedPrices: Readonly<Record<string, number>>;
  playerHumanValues: Readonly<Record<string, number>>;
}

export interface SeasonMockConfigurationSnapshotV2 {
  status: "ready";
  schema: typeof snapshotSchema;
  version: typeof snapshotVersion;
  capturedAt: string;
  payload: SeasonMockConfigurationSnapshotPayloadV2;
}

export interface SeasonMockConfigurationSnapshotMigrationRequired {
  status: "migration-required";
  schema: typeof snapshotSchema;
  reason: "missing-snapshot" | "unsupported-version";
  sourceVersion?: number | undefined;
}

export type SeasonMockConfigurationSnapshotState =
  | SeasonMockConfigurationSnapshotV2
  | SeasonMockConfigurationSnapshotMigrationRequired;

export interface CreateSeasonMockConfigurationSnapshotInput {
  season: LeagueSeason;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  playerExpectedPrices: Readonly<Record<string, number>>;
  playerHumanValues?: Readonly<Record<string, number>> | undefined;
  capturedAt?: Date | undefined;
}

export interface SeasonMockReplayConfiguration {
  season: LeagueSeason<ExplicitLeagueSeasonSettings>;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  playerExpectedPrices: Readonly<Record<string, number>>;
  playerHumanValues: Readonly<Record<string, number>>;
}

const malformedSnapshot = (): never => {
  throw new SeasonMockConfigurationSnapshotError(
    "snapshot_malformed",
    "Mock draft configuration snapshot is malformed.",
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const assertSnapshotSize = (value: unknown): void => {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return malformedSnapshot();
  }

  if (serialized === undefined) return malformedSnapshot();
  if (Buffer.byteLength(serialized, "utf8") > seasonMockConfigurationSnapshotMaxBytes) {
    throw new SeasonMockConfigurationSnapshotError(
      "snapshot_too_large",
      `Mock draft configuration snapshot exceeds the ${snapshotStorageLimitLabel} storage limit.`,
    );
  }
};

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : malformedSnapshot();

const nonEmptyString = (value: unknown): string => {
  const result = stringValue(value).trim();
  return result.length > 0 ? result : malformedSnapshot();
};

const optionalString = (value: unknown): string | undefined =>
  value === undefined ? undefined : stringValue(value);

const finiteNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : malformedSnapshot();

const nonNegativeInteger = (value: unknown): number => {
  const result = finiteNumber(value);
  return Number.isInteger(result) && result >= 0 ? result : malformedSnapshot();
};

const positiveInteger = (value: unknown): number => {
  const result = finiteNumber(value);
  return Number.isInteger(result) && result > 0 ? result : malformedSnapshot();
};

const optionalFiniteNumber = (value: unknown): number | undefined =>
  value === undefined ? undefined : finiteNumber(value);

const dateString = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(stringValue(value));
  return Number.isNaN(date.getTime()) ? malformedSnapshot() : date.toISOString();
};

const positionValue = (value: unknown): Position => {
  if (typeof value !== "string") return malformedSnapshot();
  const position = positions.find(candidate => candidate === value);
  return position ?? malformedSnapshot();
};

const plainRecord = (value: unknown): Record<string, unknown> =>
  isPlainRecord(value) ? value : malformedSnapshot();

const arrayValue = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : malformedSnapshot();

const optionalStringArray = (value: unknown): string[] | undefined =>
  value === undefined ? undefined : arrayValue(value).map(stringValue);

const leagueValue = (value: unknown): League => {
  const record = plainRecord(value);
  const provider = record.provider;
  if (provider !== "mockd" && provider !== "espn" && provider !== "sleeper" && provider !== "yahoo") {
    return malformedSnapshot();
  }

  return {
    id: nonEmptyString(record.id),
    externalLeagueId: nonEmptyString(record.externalLeagueId),
    name: nonEmptyString(record.name),
    provider,
  };
};

const fantasyTeamValue = (value: unknown): FantasyTeam => {
  const record = plainRecord(value);
  const managerDisplayNames = optionalStringArray(record.managerDisplayNames);
  const abbreviation = optionalString(record.abbreviation);

  return {
    id: nonEmptyString(record.id),
    leagueSeasonId: nonEmptyString(record.leagueSeasonId),
    ownerId: nonEmptyString(record.ownerId),
    ownerDisplayName: nonEmptyString(record.ownerDisplayName),
    ...(managerDisplayNames === undefined ? {} : { managerDisplayNames }),
    ...(abbreviation === undefined ? {} : { abbreviation }),
    displayName: nonEmptyString(record.displayName),
    draftOrderPosition: positiveInteger(record.draftOrderPosition),
  };
};

const scoringValue = (value: unknown): ScoringSettings => {
  const record = plainRecord(value);
  return {
    passingYards: finiteNumber(record.passingYards),
    passingTouchdown: finiteNumber(record.passingTouchdown),
    rushingYards: finiteNumber(record.rushingYards),
    rushingTouchdown: finiteNumber(record.rushingTouchdown),
    receivingYards: finiteNumber(record.receivingYards),
    receivingTouchdown: finiteNumber(record.receivingTouchdown),
    reception: finiteNumber(record.reception),
  };
};

const numberRecord = (value: unknown, integerOnly: boolean): Record<string, number> => {
  const record = plainRecord(value);
  return Object.fromEntries(Object.entries(record).map(([key, childValue]) => [
    nonEmptyString(key),
    integerOnly ? nonNegativeInteger(childValue) : finiteNumber(childValue),
  ]));
};

const rosterMaximumsValue = (value: unknown): Record<Position, number> => {
  const record = plainRecord(value);
  return {
    QB: nonNegativeInteger(record.QB),
    RB: nonNegativeInteger(record.RB),
    WR: nonNegativeInteger(record.WR),
    TE: nonNegativeInteger(record.TE),
    K: nonNegativeInteger(record.K),
    DST: nonNegativeInteger(record.DST),
  };
};

const settingsValue = (value: unknown): ExplicitLeagueSeasonSettings => {
  const record = plainRecord(value);
  const rosterRecord = plainRecord(record.roster);
  const keeperPolicyRecord = plainRecord(record.keeperPolicy);
  if (keeperPolicyRecord.mode !== "previous-cost-multiplier" || keeperPolicyRecord.rounding !== "ceil") {
    return malformedSnapshot();
  }
  const roster = {
    rosterSize: positiveInteger(rosterRecord.rosterSize),
    lineup: numberRecord(rosterRecord.lineup, true),
    lineupSlotCount: nonNegativeInteger(rosterRecord.lineupSlotCount),
    rosterMaximums: rosterMaximumsValue(rosterRecord.rosterMaximums),
  };
  const core = {
    expectedTeamCount: positiveInteger(record.expectedTeamCount),
    scoring: scoringValue(record.scoring),
    roster,
    keeperPolicy: {
      mode: keeperPolicyRecord.mode,
      multiplier: finiteNumber(keeperPolicyRecord.multiplier),
      rounding: keeperPolicyRecord.rounding,
    },
  } as const;

  if (record.draftFormat === "auction") {
    const auction = plainRecord(record.auction);
    return {
      ...core,
      draftFormat: "auction",
      auction: {
        budgetDollars: finiteNumber(auction.budgetDollars),
        minimumBidDollars: finiteNumber(auction.minimumBidDollars),
      },
    };
  }
  if (record.draftFormat === "snake") {
    const snake = plainRecord(record.snake);
    if (snake.reversal !== "standard" && snake.reversal !== "third-round") return malformedSnapshot();
    return {
      ...core,
      draftFormat: "snake",
      snake: {
        rounds: positiveInteger(snake.rounds),
        order: arrayValue(snake.order).map(nonEmptyString),
        reversal: snake.reversal,
      },
    };
  }

  return malformedSnapshot();
};

const setupStatusValue = (value: unknown): LeagueSeasonSetupStatus => {
  if (value === "draft" || value === "published" || value === "locked") return value;
  return malformedSnapshot();
};

const draftScheduleValue = (value: unknown): LeagueSeasonDraftSchedule | undefined => {
  if (value === undefined) return undefined;
  const record = plainRecord(value);
  const scheduledAt = optionalString(record.scheduledAt);
  const timezone = optionalString(record.timezone);
  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(timezone === undefined ? {} : { timezone }),
  };
};

const seasonValue = (value: unknown): LeagueSeason<ExplicitLeagueSeasonSettings> => {
  const record = plainRecord(value);
  const draft = draftScheduleValue(record.draft);
  const season: LeagueSeason<ExplicitLeagueSeasonSettings> = {
    id: nonEmptyString(record.id),
    league: leagueValue(record.league),
    leagueId: nonEmptyString(record.leagueId),
    seasonYear: positiveInteger(record.seasonYear),
    teams: arrayValue(record.teams).map(fantasyTeamValue),
    settings: settingsValue(record.settings),
    setupStatus: setupStatusValue(record.setupStatus),
    ...(draft === undefined ? {} : { draft }),
  };
  if (season.league.id !== season.leagueId) return malformedSnapshot();
  if (season.teams.some(team => team.leagueSeasonId !== season.id)) return malformedSnapshot();
  return season;
};

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
  const keeperRound = record.keeperRound === undefined ? undefined : positiveInteger(record.keeperRound);
  const expectedPrice = optionalFiniteNumber(record.expectedPrice);
  const source = record.source;
  if (source !== undefined && source !== "keeper" && source !== "imported") return malformedSnapshot();
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

const setupValue = (value: unknown): SeasonMockSetupSnapshot => {
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

const expectedPricesValue = (value: unknown): Readonly<Record<string, number>> => {
  const record = plainRecord(value);
  return Object.freeze(Object.fromEntries(
    Object.entries(record)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, price]) => {
        const normalizedPrice = finiteNumber(price);
        if (normalizedPrice < 0) return malformedSnapshot();
        return [nonEmptyString(key), normalizedPrice];
      }),
  ));
};

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

const migrationRequired = (
  reason: SeasonMockConfigurationSnapshotMigrationRequired["reason"],
  sourceVersion?: number,
): SeasonMockConfigurationSnapshotMigrationRequired => deepFreeze({
  status: "migration-required",
  schema: snapshotSchema,
  reason,
  ...(sourceVersion === undefined ? {} : { sourceVersion }),
});

export const normalizeSeasonMockConfigurationSnapshot = (
  value: unknown,
): SeasonMockConfigurationSnapshotState => {
  if (value === undefined) return migrationRequired("missing-snapshot");
  assertSnapshotSize(value);
  const record = plainRecord(value);
  if (record.schema !== snapshotSchema) return malformedSnapshot();

  if (record.status === "migration-required") {
    if (record.reason === "missing-snapshot") return migrationRequired(record.reason);
    if (record.reason === "unsupported-version") {
      return migrationRequired(record.reason, positiveInteger(record.sourceVersion));
    }
    return malformedSnapshot();
  }
  if (record.status !== "ready") return malformedSnapshot();
  const version = positiveInteger(record.version);
  if (version !== snapshotVersion) return migrationRequired("unsupported-version", version);

  const payloadRecord = plainRecord(record.payload);
  const payload: SeasonMockConfigurationSnapshotPayloadV2 = {
    season: seasonValue(payloadRecord.season),
    setup: setupValue(payloadRecord.setup),
    humanTeamId: nonEmptyString(payloadRecord.humanTeamId),
    playerExpectedPrices: expectedPricesValue(payloadRecord.playerExpectedPrices),
    playerHumanValues: payloadRecord.playerHumanValues === undefined
      ? expectedPricesValue(payloadRecord.playerExpectedPrices)
      : expectedPricesValue(payloadRecord.playerHumanValues),
  };
  if (payload.setup.seasonId !== payload.season.id) return malformedSnapshot();
  if (!payload.season.teams.some(team => team.id === payload.humanTeamId)) return malformedSnapshot();
  if (payload.setup.initialRosters.some(player =>
    !payload.season.teams.some(team => team.id === player.teamId)
  )) return malformedSnapshot();

  const snapshot: SeasonMockConfigurationSnapshotV2 = {
    status: "ready",
    schema: snapshotSchema,
    version: snapshotVersion,
    capturedAt: dateString(record.capturedAt),
    payload,
  };
  assertSnapshotSize(snapshot);
  return deepFreeze(snapshot);
};

export const createSeasonMockConfigurationSnapshot = ({
  season,
  setup,
  humanTeamId,
  playerExpectedPrices,
  playerHumanValues = playerExpectedPrices,
  capturedAt = new Date(),
}: CreateSeasonMockConfigurationSnapshotInput): SeasonMockConfigurationSnapshotV2 => {
  const normalizedSeason: LeagueSeason<ExplicitLeagueSeasonSettings> = {
    ...structuredClone(season),
    settings: normalizeLeagueSeasonSettings(season.settings),
  };
  const snapshot = normalizeSeasonMockConfigurationSnapshot({
    status: "ready",
    schema: snapshotSchema,
    version: snapshotVersion,
    capturedAt: capturedAt.toISOString(),
    payload: {
      season: normalizedSeason,
      setup: {
        ...structuredClone(setup),
        updatedAt: setup.updatedAt.toISOString(),
      },
      humanTeamId,
      playerExpectedPrices: { ...playerExpectedPrices },
      playerHumanValues: { ...playerHumanValues },
    },
  });
  return snapshot.status === "ready" ? snapshot : malformedSnapshot();
};

export const requireSeasonMockConfigurationSnapshot = (
  state: SeasonMockConfigurationSnapshotState,
): SeasonMockConfigurationSnapshotV2 => {
  if (state.status === "ready") return state;
  const message = state.reason === "missing-snapshot"
    ? "This mock draft predates immutable configuration snapshots and must be restarted."
    : `This mock draft uses unsupported configuration snapshot version ${state.sourceVersion ?? "unknown"} and must be migrated.`;
  throw new SeasonMockConfigurationSnapshotError("snapshot_migration_required", message);
};

export const seasonMockReplayConfiguration = (
  state: SeasonMockConfigurationSnapshotState,
): SeasonMockReplayConfiguration => {
  const { payload } = requireSeasonMockConfigurationSnapshot(state);
  return {
    season: payload.season,
    setup: {
      ...payload.setup,
      updatedAt: new Date(payload.setup.updatedAt),
    },
    humanTeamId: payload.humanTeamId,
    playerExpectedPrices: payload.playerExpectedPrices,
    playerHumanValues: payload.playerHumanValues,
  };
};
