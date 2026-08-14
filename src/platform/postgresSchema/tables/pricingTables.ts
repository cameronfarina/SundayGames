import type { PostgresTableDefinition } from "../types.js";
import { leagueSeasonDraftSetupsTable } from "./pricingTables/leagueSeasonDraftSetupsTable.js";
import { modelRunsTable } from "./pricingTables/modelRunsTable.js";
import { playerPricesTable } from "./pricingTables/playerPricesTable.js";
import { pricingSnapshotsTable } from "./pricingTables/pricingSnapshotsTable.js";

export const pricingTables: readonly PostgresTableDefinition[] = [
  modelRunsTable,
  pricingSnapshotsTable,
  playerPricesTable,
  leagueSeasonDraftSetupsTable,
];
