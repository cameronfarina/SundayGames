import type { LeagueConnection } from "../../leagueConnections/api/leagueConnectionsSchema";

export interface ConnectionCounts {
  readonly needsAttention: number;
  readonly synced: number;
  readonly total: number;
}

/**
 * A provider-side error is counted in the total but never as needing attention:
 * re-authenticating cannot fix an outage, and the total keeps such a league
 * visible rather than hiding it.
 */
export const connectionCounts = (
  connections: readonly LeagueConnection[],
): ConnectionCounts => ({
  needsAttention: connections.filter(item => item.status === "needs_attention").length,
  synced: connections.filter(item => item.status === "ok").length,
  total: connections.length,
});
