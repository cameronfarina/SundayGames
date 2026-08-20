import type { LeagueSeason } from "../../leagueSeason.js";
import type { PlatformLeagueMembership } from "../../leagueSetup.js";

export interface RegisterLeagueSeasonInput {
  actorSessionToken: string;
  season: LeagueSeason;
  memberships: readonly PlatformLeagueMembership[];
  expectedSetupRevision?: string;
  membershipWriteMode?: "replace" | "preserve";
  /** False only for provider imports; the active-league quota still applies. */
  enforceCreationRateLimit?: boolean;
  /** Links a provider connection atomically when the setup repository supports it. */
  leagueConnectionId?: string;
  now?: Date | undefined;
}

export interface ArchivePlatformLeagueInput {
  actorSessionToken: string;
  leagueId: string;
  now?: Date | undefined;
}

export interface ClaimLeagueSeasonTeamInput {
  actorSessionToken: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  now?: Date | undefined;
}

export interface JoinInvitedLeagueSeasonTeamInput extends ClaimLeagueSeasonTeamInput {
  role: PlatformLeagueMembership["role"];
  invitationTokenHash: string;
}

export interface GetLeagueSeasonInput {
  actorSessionToken: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface PrivateTeamContextInput {
  actorSessionToken: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  now?: Date | undefined;
}
