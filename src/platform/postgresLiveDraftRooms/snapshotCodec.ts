import { createHash } from "node:crypto";
import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoom,
} from "../liveDraftRooms.js";
import { deserializePlatformStoreSnapshot } from "../platformStoreSnapshotCodec.js";
import type { CompactDraftRoomSnapshotV2 } from "./contracts.js";
import { isRecord } from "./json.js";

const isStatus = (value: unknown): value is LiveDraftRoom["status"] =>
  value === "setup"
  || value === "countdown"
  || value === "live"
  || value === "paused"
  || value === "ended";

const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(new Date(value).getTime());

export const cloneRoom = (room: LiveDraftRoom): LiveDraftRoom => structuredClone(room);

export const fullSnapshotJsonForRoom = (room: LiveDraftRoom): unknown => {
  const value: unknown = JSON.parse(JSON.stringify(room));
  return value;
};

export const currentProjectionJsonForRoom = (room: LiveDraftRoom): unknown => {
  const activeSaleEventIds = new Set(room.projection.sales.map(sale => sale.saleEventId));
  const projectedRoom = {
    ...room,
    events: room.events.filter(event => activeSaleEventIds.has(event.id)),
  };
  const value: unknown = JSON.parse(JSON.stringify(projectedRoom));
  return value;
};

export const roomFromCurrentProjectionJson = (value: unknown): LiveDraftRoom => {
  const [room] = deserializePlatformStoreSnapshot({ liveDraftRooms: [value] }).liveDraftRooms;
  if (room === undefined) {
    throw new Error("Postgres current draft room projection did not contain a room.");
  }
  return room;
};

export const compactSnapshotJsonForRoom = (
  room: LiveDraftRoom,
): CompactDraftRoomSnapshotV2 => ({
  formatVersion: 2,
  room: {
    status: room.status,
    revision: room.revision,
    updatedAt: room.updatedAt.toISOString(),
    endedAt: room.endedAt?.toISOString() ?? null,
  },
});

export const snapshotHashFor = (snapshotJson: unknown): string =>
  createHash("sha256").update(JSON.stringify(snapshotJson)).digest("hex");

export const roomFromSnapshotJson = (value: unknown): LiveDraftRoom => {
  const [room] = deserializePlatformStoreSnapshot({ liveDraftRooms: [value] }).liveDraftRooms;
  if (room === undefined) {
    throw new Error("Postgres draft room snapshot did not contain a live draft room.");
  }
  const repository = new InMemoryLiveDraftRoomRepository();
  repository.replaceRooms([room]);
  return repository.getRoom(room.roomId);
};

export const isCompactSnapshot = (value: unknown): value is CompactDraftRoomSnapshotV2 => {
  if (!isRecord(value) || value.formatVersion !== 2 || !isRecord(value.room)) return false;
  const room = value.room;
  return isStatus(room.status)
    && typeof room.revision === "number"
    && Number.isInteger(room.revision)
    && room.revision > 0
    && isValidDateString(room.updatedAt)
    && (room.endedAt === null || isValidDateString(room.endedAt));
};
