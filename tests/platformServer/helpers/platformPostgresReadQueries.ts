import type { PostgresQueryResult } from "../../../src/platform/postgresPlatformStore.js";
import type { PlatformPostgresState } from "./platformPostgresState.js";
import {
  cloneDraftRoomSnapshotRow,
  cloneEventRow,
  numberValueAt,
  stringValueAt,
} from "./postgresRowUtilities.js";

export const platformPostgresReadQuery = (
  state: PlatformPostgresState,
  normalizedSql: string,
  values: readonly unknown[],
): PostgresQueryResult<unknown> | undefined => {
  if (normalizedSql.startsWith("SELECT pg_advisory_xact_lock")) {
    state.advisoryLockKeys.push(String(values[0]));
    return { rows: [] };
  }

  if (normalizedSql === "SELECT id, league_id, current_revision FROM draft_rooms WHERE id = $1") {
    const room = state.rooms.get(stringValueAt(values, 0));
    return { rows: room === undefined ? [] : [{
      id: room.id,
      league_id: room.league_id,
      current_revision: room.current_revision,
    }] };
  }

  if (normalizedSql === "SELECT current_revision, current_projection_json FROM draft_rooms WHERE id = $1") {
    const room = state.rooms.get(stringValueAt(values, 0));
    return { rows: room === undefined ? [] : [{
      current_revision: room.current_revision,
      current_projection_json: room.current_projection_json,
    }] };
  }

  if (normalizedSql.startsWith("SELECT snapshot_json FROM draft_room_snapshots")) {
    const roomId = stringValueAt(values, 0);
    const snapshot = state.roomSnapshots
      .filter(row => row.draft_room_id === roomId)
      .sort((left, right) => normalizedSql.includes("ORDER BY revision ASC")
        ? left.revision - right.revision
        : right.revision - left.revision)[0];

    return {
      rows: snapshot === undefined
        ? []
        : [{ snapshot_json: cloneDraftRoomSnapshotRow(snapshot).snapshot_json }],
    };
  }

  if (normalizedSql.startsWith("SELECT snapshots.draft_room_id, snapshots.snapshot_json FROM draft_room_snapshots AS snapshots")) {
    const seasonId = stringValueAt(values, 0);
    const roomIds = new Set([...state.rooms.values()]
      .filter(room => room.league_season_id === seasonId && room.room_type === "real")
      .map(room => room.id));
    const snapshot = state.roomSnapshots
      .filter(row => roomIds.has(row.draft_room_id))
      .sort((left, right) => right.revision - left.revision)[0];

    return {
      rows: snapshot === undefined
        ? []
        : [{
          draft_room_id: snapshot.draft_room_id,
          snapshot_json: cloneDraftRoomSnapshotRow(snapshot).snapshot_json,
        }],
    };
  }

  if (normalizedSql.startsWith("SELECT id, draft_room_id, revision, event_type")) {
    const roomId = stringValueAt(values, 0);
    const incremental = values.length === 3;
    const afterRevision = incremental ? numberValueAt(values, 1) : 0;
    const throughRevision = numberValueAt(values, incremental ? 2 : 1);
    return {
      rows: state.events
        .filter(row => row.draft_room_id === roomId
          && row.revision > afterRevision
          && row.revision <= throughRevision)
        .sort((left, right) => left.revision - right.revision)
        .map(row => cloneEventRow(row)),
    };
  }

  if (
    normalizedSql.startsWith("SELECT DISTINCT ON (draft_room_id) snapshot_json FROM draft_room_snapshots")
    || normalizedSql.startsWith("SELECT DISTINCT ON (draft_room_id) draft_room_id, snapshot_json FROM draft_room_snapshots")
  ) {
    const rows = [...new Set(state.roomSnapshots.map(snapshot => snapshot.draft_room_id))]
      .flatMap(roomId => {
        const snapshot = state.roomSnapshots
          .filter(row => row.draft_room_id === roomId)
          .sort((left, right) => right.revision - left.revision)[0];

        return snapshot === undefined ? [] : [{
          draft_room_id: snapshot.draft_room_id,
          snapshot_json: cloneDraftRoomSnapshotRow(snapshot).snapshot_json,
        }];
      });

    return { rows };
  }
  return undefined;
};
