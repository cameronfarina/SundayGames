import type {
  ExplicitLeagueSeasonSettings,
  LeagueSeason,
} from "../leagueSeason.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups.js";
import {
  seasonMockSnapshotSchema,
  seasonMockSnapshotVersion,
} from "./constants.js";

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
  schema: typeof seasonMockSnapshotSchema;
  version: typeof seasonMockSnapshotVersion;
  capturedAt: string;
  payload: SeasonMockConfigurationSnapshotPayloadV2;
}

export interface SeasonMockConfigurationSnapshotMigrationRequired {
  status: "migration-required";
  schema: typeof seasonMockSnapshotSchema;
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
