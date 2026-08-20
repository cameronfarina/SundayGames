import type { MockDraftSession } from "../mockSessions.js";
import { mockSessionValue } from "../platformStoreSnapshotCodec/decoding/mockSessions.js";
import type { MockDraftSessionRow } from "./contracts.js";

export const mockDraftSessionFromRow = (row: MockDraftSessionRow): MockDraftSession => {
  const session = mockSessionValue({
    id: row.id,
    userId: row.user_id,
    leagueId: row.league_id,
    seasonId: row.league_season_id,
    ownerId: row.owner_id,
    teamId: row.team_id,
    status: row.status,
    draftMode: row.draft_mode_json,
    configurationSnapshot: row.configuration_snapshot_json,
    revision: row.revision,
    commandLog: row.command_log_json,
    latestResultRef: row.latest_result_ref_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    abandonedAt: row.abandoned_at,
  }, `mock_sessions.${row.id}`);
  if (session.commandLog.length !== row.command_count) {
    throw new Error(`Mock draft session ${row.id} has an inconsistent command count.`);
  }
  return session;
};
