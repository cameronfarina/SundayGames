import type {
  LeagueMembersScreenshotImportInput,
  LeagueMembersScreenshotImportResult,
} from "../leagueMembersScreenshotImport.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LeagueMembersScreenshotAnalyzer,
  LeagueMembersScreenshotImageInput,
} from "../openAiLeagueMembersScreenshotAnalyzer.js";
import type { LeagueSetupImportResult, LeagueSetupMembershipSeed } from "../leagueSetupImport.js";
import type { LeagueSetupTeamAssignment } from "../leagueSetupImport/teamAssignmentPreview.js";
import type { PlatformLeagueMembership } from "../platformApp.js";
import type { PlatformInvitationRepository, PlatformInvitationView } from "../platformInvitations.js";

export interface PlatformSetupHttpErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface PlatformSetupHttpResponse<TBody = unknown> {
  status: number;
  body: TBody | PlatformSetupHttpErrorBody;
}

export interface PlatformLeagueSetupImportKnownUser {
  email: string;
  userId?: string;
  accountId?: string;
}

export interface PlatformLeagueSetupImportInput {
  actorSessionToken: string;
  seasonId?: string;
  content?: string;
  rows?: readonly string[];
  knownUsers?: readonly PlatformLeagueSetupImportKnownUser[];
  invitationRepository?: PlatformInvitationRepository;
  now?: Date | undefined;
}

export interface PlatformLeagueMembersScreenshotAnalyzeInput {
  actorSessionToken: string;
  seasonId?: string;
  image: LeagueMembersScreenshotImageInput;
  analyzer: LeagueMembersScreenshotAnalyzer;
  now?: Date | undefined;
}

export interface PlatformLeagueMembersScreenshotApplyInput {
  actorSessionToken: string;
  seasonId?: string;
  setupRevision?: string;
  import: LeagueMembersScreenshotImportInput;
  now?: Date | undefined;
}

export interface PlatformLeagueSetupImportPreviewBody {
  import: LeagueSetupImportResult;
  teamAssignments: readonly LeagueSetupTeamAssignment[];
}

export interface PlatformLeagueSetupImportPendingInvite {
  email: string;
  leagueId: string;
  role: LeagueSetupMembershipSeed["role"];
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface PlatformLeagueSetupImportApplyBody extends PlatformLeagueSetupImportPreviewBody {
  season: LeagueSeason;
  memberships: readonly PlatformLeagueMembership[];
  pendingInvites: readonly PlatformLeagueSetupImportPendingInvite[];
  invitations: readonly PlatformInvitationView[];
  invitationFailures: readonly {
    email: string;
    teamId: string;
    message: string;
  }[];
}

export interface PlatformLeagueSetupImportBlockedBody extends PlatformSetupHttpErrorBody {
  import: LeagueSetupImportResult;
}

export interface PlatformLeagueMembersScreenshotPreviewBody {
  setupRevision: string;
  extraction: LeagueMembersScreenshotImportInput;
  import: LeagueMembersScreenshotImportResult;
  availableTeamProfiles: readonly {
    teamId: string;
    ownerDisplayName: string;
    teamDisplayName: string;
  }[];
}

export interface PlatformLeagueMembersScreenshotApplyBody {
  season: LeagueSeason;
  import: LeagueMembersScreenshotImportResult;
  memberships: readonly PlatformLeagueMembership[];
  pendingInvites: readonly [];
  invitations: readonly [];
  invitationFailures: readonly [];
}
