import type { PostgresTableDefinition } from "../types.js";
import { privateNotesTable } from "./strategyTables/privateNotesTable.js";
import { strategyPlanVersionsTable } from "./strategyTables/strategyPlanVersionsTable.js";
import { strategyPlansTable } from "./strategyTables/strategyPlansTable.js";
import { targetListItemsTable } from "./strategyTables/targetListItemsTable.js";
import { targetListsTable } from "./strategyTables/targetListsTable.js";

export const strategyTables: readonly PostgresTableDefinition[] = [
  strategyPlansTable,
  strategyPlanVersionsTable,
  targetListsTable,
  targetListItemsTable,
  privateNotesTable,
];
