import type {
  PlatformInvitationKind,
  PlatformInvitationStatus,
} from "../platformInvitations.js";
import type { WorkspaceRole } from "../workspacePrivacy.js";

export interface PlatformInvitationPostgresRow {
  id: string;
  league_id: string;
  season_id: string;
  invitation_kind: PlatformInvitationKind;
  email_normalized: string | null;
  role: WorkspaceRole;
  owner_id: string | null;
  team_id: string | null;
  owner_display_name: string | null;
  team_display_name: string | null;
  invited_by_user_id: string;
  token_hash: string;
  status: PlatformInvitationStatus;
  expires_at: Date | string;
  created_at: Date | string;
  accepted_at: Date | string | null;
  accepted_by_user_id: string | null;
  revoked_at?: Date | string | null;
}

export interface PostgresPlatformInvitationRepositoryOptions {
  membershipIdFactory?: () => string;
}
