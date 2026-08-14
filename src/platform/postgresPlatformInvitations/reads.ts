import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { PlatformInvitationPostgresRow } from "./contracts.js";

export const findPendingLeagueInvitationRow = async (
  client: PostgresQueryClient,
  seasonId: string,
): Promise<PlatformInvitationPostgresRow | undefined> => {
  const result = await client.query<PlatformInvitationPostgresRow>(`
SELECT *
FROM league_invitations
WHERE season_id = $1 AND status = 'pending' AND invitation_kind = 'league'
LIMIT 1;
`.trim(), [seasonId]);
  return result.rows[0];
};

const findInvitationRow = async (
  client: PostgresQueryClient,
  sql: string,
  value: string,
): Promise<PlatformInvitationPostgresRow | undefined> => {
  const result = await client.query<PlatformInvitationPostgresRow>(
    sql,
    [value],
  );
  return result.rows[0];
};

export const findInvitationByIdRow = async (
  client: PostgresQueryClient,
  invitationId: string,
): Promise<PlatformInvitationPostgresRow | undefined> =>
  await findInvitationRow(
    client,
    "SELECT * FROM league_invitations WHERE id = $1",
    invitationId,
  );

export const findInvitationByTokenHashRow = async (
  client: PostgresQueryClient,
  tokenHash: string,
): Promise<PlatformInvitationPostgresRow | undefined> =>
  await findInvitationRow(
    client,
    "SELECT * FROM league_invitations WHERE token_hash = $1",
    tokenHash,
  );

export const listInvitationRows = async (
  client: PostgresQueryClient,
  seasonId: string,
): Promise<readonly PlatformInvitationPostgresRow[]> => {
  const result = await client.query<PlatformInvitationPostgresRow>(`
SELECT *
FROM league_invitations
WHERE season_id = $1
ORDER BY created_at DESC;
`.trim(), [seasonId]);
  return result.rows;
};
