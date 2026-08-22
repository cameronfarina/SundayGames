import type { DiscoveredLeague, LeagueConnection } from "../api/leagueConnectionsSchema";
import type { LeagueDraftSetup } from "../api/leagueConnectionsSchema";

export type LeagueImportStatus =
  | "idle"
  | "connecting"
  | "importing"
  | "imported"
  | "connected"
  | "error";

export interface LeagueImportState {
  readonly draftSetup?: LeagueDraftSetup;
  readonly status: LeagueImportStatus;
  readonly issues?: readonly string[];
  readonly leagueSlug?: string;
  readonly message?: string;
}

export type LeagueImportStates = Record<string, LeagueImportState>;

/** A provider league is the same league only when its season matches too. */
export const discoveredLeagueKey = (
  league: Pick<DiscoveredLeague, "providerLeagueId" | "season">,
): string => `${league.providerLeagueId}:${league.season}`;

export const isImportRunning = (state: LeagueImportState): boolean =>
  state.status === "connecting" || state.status === "importing";

export const importStateLabel = (state: LeagueImportState): string => {
  switch (state.status) {
    case "connecting": return "Connecting...";
    case "importing": return "Building your league...";
    case "imported": return "Imported into Sunday Games";
    case "connected": return "Connected, not imported yet";
    case "error": return state.message ?? "Could not import this league.";
    case "idle": return "Ready to import";
  }
};

/**
 * A league already on the account keeps whatever the server knows about it, so a
 * fresh search never offers to redo work that is already done.
 */
export const importStateFromConnections = (
  connections: readonly LeagueConnection[],
  league: DiscoveredLeague,
): LeagueImportState => {
  const key = discoveredLeagueKey(league);
  const match = connections.find(connection => discoveredLeagueKey(connection) === key);
  if (match === undefined) return { status: "idle" };
  return match.importedLeagueSlug === undefined
    ? { status: "connected" }
    : { leagueSlug: match.importedLeagueSlug, status: "imported" };
};
