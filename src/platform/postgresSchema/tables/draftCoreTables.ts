import type { PostgresTableDefinition } from "../types.js";
import { draftRoomEventsTable } from "./draftCoreTables/draftRoomEventsTable.js";
import { draftRoomParticipantsTable } from "./draftCoreTables/draftRoomParticipantsTable.js";
import { draftRoomsTable } from "./draftCoreTables/draftRoomsTable.js";
import { liveDraftStreamLeasesTable } from "./draftCoreTables/liveDraftStreamLeasesTable.js";

export const draftCoreTables: readonly PostgresTableDefinition[] = [
  draftRoomsTable,
  draftRoomParticipantsTable,
  draftRoomEventsTable,
  liveDraftStreamLeasesTable,
];
