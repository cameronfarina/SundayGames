import type { PlatformLeagueMembership } from "../leagueSetup.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { membershipIdFor } from "./identifiers.js";

export const replaceMemberships = async (
  client: PostgresQueryClient,
  leagueId: string,
  memberships: readonly PlatformLeagueMembership[],
  now: Date,
): Promise<void> => {
  await client.query("DELETE FROM league_memberships WHERE league_id = $1", [leagueId]);
  for (const membership of memberships) {
    await client.query(`
INSERT INTO league_memberships (
  id, league_id, user_id, role, status, created_at, updated_at
) VALUES ($1, $2, $3, $4, 'active', $5, $5);
`.trim(), [
      membershipIdFor(membership.leagueId, membership.userId),
      membership.leagueId,
      membership.userId,
      membership.role,
      now,
    ]);
  }
};
