import { randomBytes } from "node:crypto";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import type { PostgresQueryClient } from "./postgresPlatformStore.js";
import type {
  PlatformInvitationRecord,
  PlatformInvitationRepository,
  PlatformInvitationStatus,
} from "./platformInvitations.js";
import type { WorkspaceRole } from "./workspacePrivacy.js";

export interface PlatformInvitationPostgresRow {
  id: string;
  league_id: string;
  season_id: string;
  email_normalized: string;
  role: WorkspaceRole;
  owner_id: string;
  team_id: string;
  owner_display_name: string;
  team_display_name: string;
  invited_by_user_id: string;
  token_hash: string;
  status: PlatformInvitationStatus;
  expires_at: Date | string;
  created_at: Date | string;
  accepted_at: Date | string | null;
  accepted_by_user_id: string | null;
  revoked_at?: Date | string | null;
}

const createLeagueInvitationsTableStatement = `
CREATE TABLE IF NOT EXISTS league_invitations (
  id text PRIMARY KEY,
  league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_id text NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'observer')),
  owner_id text NOT NULL,
  team_id text NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  owner_display_name text NOT NULL,
  team_display_name text NOT NULL,
  invited_by_user_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id text REFERENCES accounts(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

const pendingLeagueInvitationsIndexStatement = `
CREATE UNIQUE INDEX IF NOT EXISTS league_invitations_pending_team_key
ON league_invitations (season_id, team_id)
WHERE status = 'pending';
`.trim();

const leagueInvitationsSeasonIndexStatement = `
CREATE INDEX IF NOT EXISTS league_invitations_season_status_idx
ON league_invitations (season_id, status);
`.trim();

export const platformInvitationSchemaStatements = [
  createLeagueInvitationsTableStatement,
  pendingLeagueInvitationsIndexStatement,
  leagueInvitationsSeasonIndexStatement,
] as const;

const asDate = (value: Date | string): Date => value instanceof Date ? new Date(value) : new Date(value);

const invitationForRow = (row: PlatformInvitationPostgresRow): PlatformInvitationRecord => ({
  id: row.id,
  leagueId: row.league_id,
  seasonId: row.season_id,
  email: row.email_normalized,
  role: row.role,
  ownerId: row.owner_id,
  teamId: row.team_id,
  ownerDisplayName: row.owner_display_name,
  teamDisplayName: row.team_display_name,
  invitedByUserId: row.invited_by_user_id,
  tokenHash: row.token_hash,
  status: row.status,
  expiresAt: asDate(row.expires_at),
  createdAt: asDate(row.created_at),
  ...(row.accepted_at === null ? {} : { acceptedAt: asDate(row.accepted_at) }),
  ...(row.accepted_by_user_id === null ? {} : { acceptedByUserId: row.accepted_by_user_id }),
  ...(row.revoked_at === undefined || row.revoked_at === null
    ? {}
    : { revokedAt: asDate(row.revoked_at) }),
});

export interface PostgresPlatformInvitationRepositoryOptions {
  membershipIdFactory?: () => string;
}

export class PostgresPlatformInvitationRepository implements PlatformInvitationRepository {
  readonly #membershipIdFactory: () => string;

  constructor(
    private readonly client: PostgresTransactionalQueryClient,
    options: PostgresPlatformInvitationRepositoryOptions = {},
  ) {
    this.#membershipIdFactory = options.membershipIdFactory
      ?? (() => `membership_${randomBytes(12).toString("base64url")}`);
  }

  static async initializeSchema(client: PostgresQueryClient): Promise<void> {
    for (const statement of platformInvitationSchemaStatements) await client.query(statement);
  }

  async savePending(invitation: PlatformInvitationRecord): Promise<PlatformInvitationRecord> {
    const result = await this.client.query<PlatformInvitationPostgresRow>(`
INSERT INTO league_invitations (
  id, league_id, season_id, email_normalized, role, owner_id, team_id,
  owner_display_name, team_display_name, invited_by_user_id, token_hash,
  status, expires_at, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, $13)
RETURNING *;
`.trim(), [
      invitation.id,
      invitation.leagueId,
      invitation.seasonId,
      invitation.email,
      invitation.role,
      invitation.ownerId,
      invitation.teamId,
      invitation.ownerDisplayName,
      invitation.teamDisplayName,
      invitation.invitedByUserId,
      invitation.tokenHash,
      invitation.expiresAt,
      invitation.createdAt,
    ]);
    const row = result.rows[0];
    if (row === undefined) throw new Error("Invitation was not persisted.");
    return invitationForRow(row);
  }

  async findById(invitationId: string): Promise<PlatformInvitationRecord | null> {
    const result = await this.client.query<PlatformInvitationPostgresRow>(
      "SELECT * FROM league_invitations WHERE id = $1",
      [invitationId],
    );
    return result.rows[0] === undefined ? null : invitationForRow(result.rows[0]);
  }

  async findByTokenHash(tokenHash: string): Promise<PlatformInvitationRecord | null> {
    const result = await this.client.query<PlatformInvitationPostgresRow>(
      "SELECT * FROM league_invitations WHERE token_hash = $1",
      [tokenHash],
    );
    return result.rows[0] === undefined ? null : invitationForRow(result.rows[0]);
  }

  async listForSeason(seasonId: string): Promise<readonly PlatformInvitationRecord[]> {
    const result = await this.client.query<PlatformInvitationPostgresRow>(`
SELECT *
FROM league_invitations
WHERE season_id = $1
ORDER BY created_at DESC;
`.trim(), [seasonId]);
    return result.rows.map(invitationForRow);
  }

  async accept(
    invitationId: string,
    accountId: string,
    acceptedAt: Date,
  ): Promise<PlatformInvitationRecord | null> {
    return this.client.transaction(async transactionClient => {
      const acceptedResult = await transactionClient.query<PlatformInvitationPostgresRow>(`
UPDATE league_invitations
SET status = 'accepted', accepted_by_user_id = $2, accepted_at = $3, updated_at = $3
WHERE id = $1
  AND status = 'pending'
  AND expires_at >= $3
RETURNING *;
`.trim(), [invitationId, accountId, acceptedAt]);
      const acceptedRow = acceptedResult.rows[0];
      if (acceptedRow === undefined) return null;

      await transactionClient.query(`
INSERT INTO league_memberships (id, league_id, user_id, role, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, 'active', $5, $5)
ON CONFLICT (league_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  status = 'active',
  updated_at = EXCLUDED.updated_at
RETURNING id;
`.trim(), [
        this.#membershipIdFactory(),
        acceptedRow.league_id,
        accountId,
        acceptedRow.role,
        acceptedAt,
      ]);

      const teamResult = await transactionClient.query<{ id: string }>(`
UPDATE fantasy_teams
SET owner_user_id = $3, updated_at = $4
WHERE id = $1
  AND league_season_id = $2
  AND (owner_user_id IS NULL OR owner_user_id = $3)
RETURNING id;
`.trim(), [acceptedRow.team_id, acceptedRow.season_id, accountId, acceptedAt]);
      if (teamResult.rows[0] === undefined) {
        throw new Error("The invited team is already claimed by another account.");
      }

      return invitationForRow(acceptedRow);
    });
  }

  async revoke(invitationId: string, revokedAt: Date): Promise<PlatformInvitationRecord | null> {
    const result = await this.client.query<PlatformInvitationPostgresRow>(`
UPDATE league_invitations
SET status = 'revoked', revoked_at = $2, updated_at = $2
WHERE id = $1 AND status = 'pending'
RETURNING *;
`.trim(), [invitationId, revokedAt]);
    return result.rows[0] === undefined ? null : invitationForRow(result.rows[0]);
  }
}
