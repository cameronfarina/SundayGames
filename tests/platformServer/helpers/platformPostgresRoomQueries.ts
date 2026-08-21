import type { PostgresQueryResult } from "../../../src/platform/postgresPlatformStore.js";
import type { PlatformPostgresState } from "./platformPostgresState.js";
import {
  cloneDate,
  dateValueAt,
  jsonValue,
  nullableDateValueAt,
  nullableNumberValueAt,
  nullableStringValueAt,
  numberValueAt,
  stringValueAt,
  valueAt,
} from "./postgresRowUtilities.js";

export const platformPostgresRoomQuery = (
  state: PlatformPostgresState,
  normalizedSql: string,
  values: readonly unknown[],
): PostgresQueryResult<unknown> | undefined => {
  if (normalizedSql.startsWith("INSERT INTO draft_rooms")) {
    const id = stringValueAt(values, 0);
    const leagueId = stringValueAt(values, 1);
    const seasonId = stringValueAt(values, 2);
    const status = stringValueAt(values, 3);
    const createdByUserId = stringValueAt(values, 4);
    const startsAt = nullableDateValueAt(values, 5);
    const startedAt = nullableDateValueAt(values, 6);
    const endedAt = nullableDateValueAt(values, 7);
    const currentRevision = numberValueAt(values, 8);
    const createdAt = dateValueAt(values, 9);
    const updatedAt = dateValueAt(values, 10);
    const currentProjectionJson = valueAt(values, 11);
    if (state.rooms.has(id)) return { rows: [], rowCount: 0 };

    state.rooms.set(id, {
      id,
      league_id: leagueId,
      league_season_id: seasonId,
      room_type: "real",
      status,
      created_by_user_id: createdByUserId,
      current_revision: currentRevision,
      starts_at: cloneDate(startsAt),
      started_at: cloneDate(startedAt),
      ended_at: cloneDate(endedAt),
      created_at: new Date(createdAt.getTime()),
      updated_at: new Date(updatedAt.getTime()),
      current_projection_json: jsonValue(currentProjectionJson),
    });

    return { rows: [{ id }], rowCount: 1 };
  }

  if (normalizedSql.startsWith("UPDATE draft_rooms SET status = $2")) {
    if (state.failNextDraftRoomRevisionUpdate) {
      state.failNextDraftRoomRevisionUpdate = false;
      throw new Error("Injected draft room synchronization failure.");
    }
    const roomId = stringValueAt(values, 0);
    const status = stringValueAt(values, 1);
    const currentRevision = numberValueAt(values, 2);
    const startedAt = nullableDateValueAt(values, 3);
    const endedAt = nullableDateValueAt(values, 4);
    const updatedAt = dateValueAt(values, 5);
    const expectedCurrentRevision = numberValueAt(values, 6);
    const currentProjectionJson = valueAt(values, 7);
    const room = state.rooms.get(roomId);
    if (room === undefined || room.current_revision !== expectedCurrentRevision) {
      return { rows: [], rowCount: 0 };
    }

    state.rooms.set(roomId, {
      ...room,
      status,
      current_revision: currentRevision,
      started_at: cloneDate(startedAt),
      ended_at: cloneDate(endedAt),
      updated_at: new Date(updatedAt.getTime()),
      current_projection_json: jsonValue(currentProjectionJson),
    });

    return { rows: [{ current_revision: currentRevision }], rowCount: 1 };
  }

  if (normalizedSql.startsWith("UPDATE draft_rooms SET current_projection_json = $2::jsonb")) {
    const roomId = stringValueAt(values, 0);
    const currentProjectionJson = valueAt(values, 1);
    const expectedRevision = numberValueAt(values, 2);
    const room = state.rooms.get(roomId);
    if (room === undefined || room.current_revision !== expectedRevision) {
      return { rows: [], rowCount: 0 };
    }
    state.rooms.set(roomId, {
      ...room,
      current_projection_json: jsonValue(currentProjectionJson),
    });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.startsWith("INSERT INTO draft_room_events")) {
    const id = stringValueAt(values, 0);
    const roomId = stringValueAt(values, 1);
    const revision = numberValueAt(values, 2);
    const sequence = numberValueAt(values, 3);
    const eventType = stringValueAt(values, 4);
    const actorUserId = stringValueAt(values, 5);
    const idempotencyKey = nullableStringValueAt(values, 6);
    const mutationHash = nullableStringValueAt(values, 7);
    const expectedRevision = nullableNumberValueAt(values, 8);
    const rawCommand = nullableStringValueAt(values, 9);
    const payloadJson = valueAt(values, 10);
    const occurredAt = dateValueAt(values, 11);

    state.events.push({
      id,
      draft_room_id: roomId,
      revision,
      sequence,
      event_type: eventType,
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      mutation_hash: mutationHash,
      expected_revision: expectedRevision,
      raw_command: rawCommand,
      payload_json: jsonValue(payloadJson),
      occurred_at: new Date(occurredAt.getTime()),
    });

    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.startsWith("INSERT INTO draft_room_snapshots")) {
    const id = stringValueAt(values, 0);
    const roomId = stringValueAt(values, 1);
    const revision = numberValueAt(values, 2);
    const snapshotJson = valueAt(values, 3);
    const snapshotHash = stringValueAt(values, 4);
    const createdAt = dateValueAt(values, 5);

    state.roomSnapshots.push({
      id,
      draft_room_id: roomId,
      revision,
      snapshot_json: jsonValue(snapshotJson),
      snapshot_hash: snapshotHash,
      created_at: new Date(createdAt.getTime()),
    });

    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.startsWith("DELETE FROM draft_room_snapshots")) {
    const roomId = stringValueAt(values, 0);
    const minimumRecentRevision = numberValueAt(values, 1);
    const baseRevision = state.roomSnapshots
      .filter(snapshot => snapshot.draft_room_id === roomId)
      .reduce((minimum, snapshot) => Math.min(minimum, snapshot.revision), Number.POSITIVE_INFINITY);
    state.roomSnapshots.splice(
      0,
      state.roomSnapshots.length,
      ...state.roomSnapshots.filter(snapshot =>
        snapshot.draft_room_id !== roomId
        || snapshot.revision === baseRevision
        || snapshot.revision >= minimumRecentRevision
      ),
    );

    return { rows: [], rowCount: 0 };
  }

  if (normalizedSql.startsWith("INSERT INTO draft_room_sales")) {
    const id = stringValueAt(values, 0);
    const roomId = stringValueAt(values, 1);
    const sourceEventId = stringValueAt(values, 2);
    const fantasyTeamId = stringValueAt(values, 3);
    const playerName = stringValueAt(values, 4);
    const normalizedPlayerName = stringValueAt(values, 5);
    const position = stringValueAt(values, 6);
    const price = numberValueAt(values, 7);
    const expectedPrice = numberValueAt(values, 8);
    const createdAt = dateValueAt(values, 9);

    state.sales.set(id, {
      id,
      draft_room_id: roomId,
      source_event_id: sourceEventId,
      fantasy_team_id: fantasyTeamId,
      player_name: playerName,
      normalized_player_name: normalizedPlayerName,
      position,
      price,
      expected_price: expectedPrice,
      status: "active",
      voided_by_event_id: null,
      created_at: new Date(createdAt.getTime()),
    });

    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.startsWith("UPDATE draft_room_sales SET status = 'voided'")) {
    const sourceEventId = stringValueAt(values, 0);
    const voidedByEventId = stringValueAt(values, 1);
    const sale = [...state.sales.values()].find(candidate => candidate.source_event_id === sourceEventId);
    if (sale === undefined) return { rows: [], rowCount: 0 };

    state.sales.set(sale.id, {
      ...sale,
      status: "voided",
      voided_by_event_id: voidedByEventId,
    });

    return { rows: [], rowCount: 1 };
  }
  return undefined;
};
