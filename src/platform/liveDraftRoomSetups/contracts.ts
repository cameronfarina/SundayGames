import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../liveDraftRooms.js";

export interface LiveDraftRoomSetup {
  seasonId: string;
  sourceVersion: string;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  contentHash: string;
  updatedAt: Date;
}

export interface SaveLiveDraftRoomSetupInput {
  seasonId: string;
  sourceVersion: string;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  updatedAt?: Date | undefined;
}

export interface LiveDraftRoomSetupRepository {
  findForSeason(seasonId: string): Promise<LiveDraftRoomSetup | null>;
  save(
    input: SaveLiveDraftRoomSetupInput,
    options?: { expectedContentHash?: string | null | undefined },
  ): Promise<LiveDraftRoomSetup>;
}

export interface LiveDraftRoomSetupPostgresRow {
  league_season_id: string;
  source_version: string;
  player_catalog_json: unknown;
  initial_rosters_json: unknown;
  content_hash: string;
  updated_at: Date | string;
}
