import type { AccountRecord } from "../../auth.js";
import type { LeagueSeason } from "../../leagueSeason.js";
import type { PlatformLeagueMembership } from "../../leagueSetup.js";
import type {
  ArchivePlatformLeagueInput,
  RegisterLeagueSeasonInput,
} from "../contracts/league.js";
import { canMutateLeague, type PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";

const assertMembershipTeams = (
  season: LeagueSeason,
  memberships: readonly PlatformLeagueMembership[],
): void => {
  for (const membership of memberships) {
    if (membership.leagueId !== season.leagueId) {
      throw new PlatformAppError("league_not_found", "Membership does not match this league season.");
    }
    if (membership.ownerId === undefined && membership.teamId === undefined) continue;
    const team = season.teams.find(candidate =>
      candidate.id === membership.teamId && candidate.ownerId === membership.ownerId
    );
    if (team === undefined) {
      throw new PlatformAppError("team_not_found", "Membership team was not found in this league season.");
    }
  }
};

const assertRegistrationAllowed = async (
  context: PlatformAppContext,
  account: AccountRecord,
  season: LeagueSeason,
  memberships: readonly PlatformLeagueMembership[],
): Promise<void> => {
  const existing = await context.leagueSetup.findMembership(account.id, season.leagueId);
  const registered = await context.leagueSetup.hasLeagueSeasonForLeague(season.leagueId);
  const submitted = memberships.find(membership =>
    membership.userId === account.id && membership.leagueId === season.leagueId
  );
  const allowedByExisting = existing !== null && canMutateLeague(existing.role);
  const allowedBySubmitted = submitted !== undefined && canMutateLeague(submitted.role);
  if (!allowedByExisting && (registered || !allowedBySubmitted)) {
    throw new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    );
  }
  assertMembershipTeams(season, memberships);
};

export const createLeagueRegistrationOperations = (context: PlatformAppContext) => ({
  listLeagueMemberships: async (leagueId: string): Promise<readonly PlatformLeagueMembership[]> =>
    cloneForRead(await context.leagueSetup.membershipsForLeague(leagueId)),

  registerLeagueSeason: async (input: RegisterLeagueSeasonInput): Promise<LeagueSeason> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await assertRegistrationAllowed(context, account, input.season, input.memberships);
    const registered = await context.leagueSetup.registerLeagueSeason({
      season: input.season,
      memberships: input.memberships,
      createdByUserId: account.id,
      ...(input.expectedSetupRevision === undefined
        ? {}
        : { expectedSetupRevision: input.expectedSetupRevision }),
      ...(input.membershipWriteMode === undefined
        ? {}
        : { membershipWriteMode: input.membershipWriteMode }),
      now: input.now,
    });
    if (context.usesExternalLeagueSetup) {
      context.store.registerLeagueSeason({
        season: registered,
        memberships: input.memberships,
        createdByUserId: account.id,
        enforceCreationLimits: false,
        ...(input.membershipWriteMode === undefined
          ? {}
          : { membershipWriteMode: input.membershipWriteMode }),
        now: input.now,
      });
    }
    return cloneForRead(registered);
  },

  archiveLeague: async (input: ArchivePlatformLeagueInput): Promise<boolean> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    if (!await context.leagueSetup.hasLeagueSeasonForLeague(input.leagueId)) {
      throw new PlatformAppError("league_not_found", "League was not found.");
    }
    await context.requireSharedMutation(account, input.leagueId);
    const archived = await context.leagueSetup.archiveLeague({
      leagueId: input.leagueId,
      archivedByUserId: account.id,
      now: input.now,
    });
    if (!archived) throw new PlatformAppError("league_not_found", "League was not found.");
    if (context.usesExternalLeagueSetup) {
      context.store.archiveLeague({
        leagueId: input.leagueId,
        archivedByUserId: account.id,
        now: input.now,
      });
    }
    return true;
  },
});
