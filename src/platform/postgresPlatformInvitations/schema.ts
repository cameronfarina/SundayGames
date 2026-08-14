const createLeagueInvitationsTableStatement = `
CREATE TABLE IF NOT EXISTS league_invitations (
  id text PRIMARY KEY,
  league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_id text NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  invitation_kind text NOT NULL DEFAULT 'team' CHECK (invitation_kind IN ('team', 'league')),
  email_normalized text,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'observer')),
  owner_id text,
  team_id text REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  owner_display_name text,
  team_display_name text,
  invited_by_user_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id text REFERENCES accounts(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT league_invitations_kind_fields_check CHECK (
    (invitation_kind = 'league' AND email_normalized IS NULL AND owner_id IS NULL AND team_id IS NULL AND owner_display_name IS NULL AND team_display_name IS NULL)
    OR
    (invitation_kind = 'team' AND email_normalized IS NOT NULL AND owner_id IS NOT NULL AND team_id IS NOT NULL AND owner_display_name IS NOT NULL AND team_display_name IS NOT NULL)
  )
);
`.trim();

const pendingTeamIndexStatement = `
CREATE UNIQUE INDEX IF NOT EXISTS league_invitations_pending_team_key
ON league_invitations (season_id, team_id)
WHERE status = 'pending' AND invitation_kind = 'team';
`.trim();

const pendingLeagueIndexStatement = `
CREATE UNIQUE INDEX IF NOT EXISTS league_invitations_pending_league_key
ON league_invitations (season_id)
WHERE status = 'pending' AND invitation_kind = 'league';
`.trim();

const seasonStatusIndexStatement = `
CREATE INDEX IF NOT EXISTS league_invitations_season_status_idx
ON league_invitations (season_id, status);
`.trim();

export const platformInvitationSchemaStatements: readonly string[] = [
  createLeagueInvitationsTableStatement,
  pendingTeamIndexStatement,
  pendingLeagueIndexStatement,
  seasonStatusIndexStatement,
];
