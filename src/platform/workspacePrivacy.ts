export type WorkspaceRole = "owner" | "admin" | "member" | "observer";

export type SharedLeagueResourceType =
  | "draft-room"
  | "keeper-rules"
  | "league-settings"
  | "owner-profiles"
  | "rosters"
  | "sync-state";

export type PrivatePrepArtifactType =
  | "coach-conversation"
  | "draft-plan"
  | "mock-session"
  | "mock-results"
  | "player-note"
  | "player-notes"
  | "private-note"
  | "shortlist"
  | "simulation-result"
  | "simulation-run"
  | "strategy-plan"
  | "strategy-lab";

export type WorkspaceAuthorizationDenialReason =
  | "league_membership_required"
  | "private_prep_owner_required"
  | "shared_setup_mutation_role_required";

export type WorkspaceAuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: WorkspaceAuthorizationDenialReason };

export interface WorkspaceUser {
  id: string;
}

export interface LeagueMembership {
  userId: string;
  leagueId: string;
  role: WorkspaceRole;
}

export interface SharedLeagueResource {
  leagueId: string;
  type?: SharedLeagueResourceType | string;
  workspace?: "shared";
}

export interface PrivatePrepArtifact {
  leagueId: string;
  ownerUserId: string;
  type?: PrivatePrepArtifactType | string;
  workspace?: "private-prep";
}

const sharedSetupMutationRoles: ReadonlySet<WorkspaceRole> = new Set(["owner", "admin"]);

const allowed = (): WorkspaceAuthorizationDecision => ({ allowed: true });

const denied = (reason: WorkspaceAuthorizationDenialReason): WorkspaceAuthorizationDecision => ({
  allowed: false,
  reason,
});

const membershipFor = (
  user: WorkspaceUser,
  leagueId: string,
  memberships: readonly LeagueMembership[],
): LeagueMembership | undefined =>
  memberships.find(membership => membership.userId === user.id && membership.leagueId === leagueId);

export const authorizeSharedLeagueResourceRead = (
  user: WorkspaceUser,
  resource: SharedLeagueResource,
  memberships: readonly LeagueMembership[],
): WorkspaceAuthorizationDecision =>
  membershipFor(user, resource.leagueId, memberships) === undefined
    ? denied("league_membership_required")
    : allowed();

export const authorizeSharedLeagueSetupMutation = (
  user: WorkspaceUser,
  resource: SharedLeagueResource,
  memberships: readonly LeagueMembership[],
): WorkspaceAuthorizationDecision => {
  const membership = membershipFor(user, resource.leagueId, memberships);

  if (membership === undefined) {
    return denied("league_membership_required");
  }

  return sharedSetupMutationRoles.has(membership.role)
    ? allowed()
    : denied("shared_setup_mutation_role_required");
};

const authorizePrivatePrepArtifactAccess = (
  user: WorkspaceUser,
  artifact: PrivatePrepArtifact,
  memberships: readonly LeagueMembership[],
): WorkspaceAuthorizationDecision => {
  if (membershipFor(user, artifact.leagueId, memberships) === undefined) {
    return denied("league_membership_required");
  }

  return artifact.ownerUserId === user.id
    ? allowed()
    : denied("private_prep_owner_required");
};

export const authorizePrivatePrepArtifactRead = (
  user: WorkspaceUser,
  artifact: PrivatePrepArtifact,
  memberships: readonly LeagueMembership[],
): WorkspaceAuthorizationDecision =>
  authorizePrivatePrepArtifactAccess(user, artifact, memberships);

export const authorizePrivatePrepArtifactMutation = (
  user: WorkspaceUser,
  artifact: PrivatePrepArtifact,
  memberships: readonly LeagueMembership[],
): WorkspaceAuthorizationDecision =>
  authorizePrivatePrepArtifactAccess(user, artifact, memberships);
