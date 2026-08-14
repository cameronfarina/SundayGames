import type { LiveDraftRoomSetup, LiveDraftRoomSetupPostgresRow } from "./contracts.js";
import { catalogEntryValue } from "./decoding/catalog.js";
import { arrayValue, dateValue } from "./decoding/primitives.js";
import { initialRosterPlayerValue } from "./decoding/roster.js";

export const setupFromRow = (row: LiveDraftRoomSetupPostgresRow): LiveDraftRoomSetup => ({
  seasonId: row.league_season_id,
  sourceVersion: row.source_version,
  playerCatalog: arrayValue(row.player_catalog_json, "playerCatalog", catalogEntryValue),
  initialRosters: arrayValue(row.initial_rosters_json, "initialRosters", initialRosterPlayerValue),
  contentHash: row.content_hash,
  updatedAt: dateValue(row.updated_at, "updatedAt"),
});
