import type { PostgresTableDefinition } from "../types.js";
import { fantasyTeamsTable } from "./leagueTables/fantasyTeamsTable.js";
import { leagueMembershipsTable } from "./leagueTables/leagueMembershipsTable.js";
import { leagueSeasonsTable } from "./leagueTables/leagueSeasonsTable.js";
import { leaguesTable } from "./leagueTables/leaguesTable.js";
import { rosterRuleSetsTable } from "./leagueTables/rosterRuleSetsTable.js";

export const leagueTables: readonly PostgresTableDefinition[] = [
  leaguesTable,
  leagueMembershipsTable,
  leagueSeasonsTable,
  fantasyTeamsTable,
  rosterRuleSetsTable,
];
