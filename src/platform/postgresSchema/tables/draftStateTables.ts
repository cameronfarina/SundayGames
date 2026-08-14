import type { PostgresTableDefinition } from "../types.js";
import { draftRoomPlayerStatesTable } from "./draftStateTables/draftRoomPlayerStatesTable.js";
import { draftRoomSalesTable } from "./draftStateTables/draftRoomSalesTable.js";
import { draftRoomSnapshotsTable } from "./draftStateTables/draftRoomSnapshotsTable.js";
import { draftRoomTeamStatesTable } from "./draftStateTables/draftRoomTeamStatesTable.js";

export const draftStateTables: readonly PostgresTableDefinition[] = [
  draftRoomSalesTable,
  draftRoomTeamStatesTable,
  draftRoomPlayerStatesTable,
  draftRoomSnapshotsTable,
];
