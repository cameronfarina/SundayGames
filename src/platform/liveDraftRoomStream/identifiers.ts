import type { LiveDraftRoom } from "../liveDraftRooms.js";

export const eventStreamIdFor = (roomId: string, revision: number): string =>
  `${roomId}:${revision}`;

export const snapshotStreamIdFor = (room: LiveDraftRoom): string =>
  `${eventStreamIdFor(room.roomId, room.revision)}:snapshot`;
