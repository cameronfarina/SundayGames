import { auditTables } from "./auditTables.js";
import { authTables } from "./authTables.js";
import { coachTables } from "./coachTables.js";
import { draftCoreTables } from "./draftCoreTables.js";
import { draftExportTables } from "./draftExportTables.js";
import { draftStateTables } from "./draftStateTables.js";
import { fantasyProsTables } from "./fantasyProsTables.js";
import { historyTables } from "./historyTables.js";
import { jobTables } from "./jobTables.js";
import { leagueConnectionTables } from "./leagueConnectionTables.js";
import { leagueTables } from "./leagueTables.js";
import { mockTables } from "./mockTables.js";
import { playerNewsTables } from "./playerNewsTables.js";
import { playerTables } from "./playerTables.js";
import { pricingTables } from "./pricingTables.js";
import { simulationTables } from "./simulationTables.js";
import { strategyTables } from "./strategyTables.js";
import type { PostgresTableDefinition } from "../types.js";

export const platformPostgresTables: readonly PostgresTableDefinition[] = [
  ...authTables,
  ...leagueTables,
  ...playerTables,
  ...historyTables,
  ...pricingTables,
  ...jobTables,
  ...strategyTables,
  ...coachTables,
  ...mockTables,
  ...simulationTables,
  ...draftCoreTables,
  ...draftStateTables,
  ...draftExportTables,
  ...auditTables,
  ...playerNewsTables,
  ...fantasyProsTables,
  ...leagueConnectionTables,
];
