import type { WorkspaceRole } from "../workspacePrivacy.js";
import type { PlatformLeagueMembership } from "../leagueSetup.js";
import type {
  PlatformLeagueInvitationView,
  PlatformTeamInvitationView,
} from "./contracts.js";

export interface IssuePlatformInvitationInput {
  leagueId: string;
  seasonId: string;
  email: string;
  role: WorkspaceRole;
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  invitedByUserId: string;
  now: Date;
  expiresAt: Date;
}

export interface IssuePlatformInvitationOptions {
  idFactory?: () => string;
  tokenFactory?: () => string;
  leagueTokenSecret?: string;
}

export interface IssuePlatformLeagueInvitationInput {
  leagueId: string;
  seasonId: string;
  invitedByUserId: string;
  now: Date;
  expiresAt: Date;
}

export interface AcceptPlatformInvitationInput {
  token: string;
  account: { id: string; email: string };
  now: Date;
}

export interface AcceptedPlatformInvitation {
  invitation: PlatformTeamInvitationView;
  membership: PlatformLeagueMembership;
}

export interface JoinedPlatformLeagueInvitation {
  invitation: PlatformLeagueInvitationView;
  membership: PlatformLeagueMembership;
}

export interface ReissuePlatformInvitationInput {
  invitationId: string;
  invitedByUserId: string;
  now: Date;
  expiresAt: Date;
}
