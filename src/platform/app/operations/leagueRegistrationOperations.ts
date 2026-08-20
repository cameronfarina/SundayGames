import type { LeagueSeason } from "../../leagueSeason.js";
import type { PlatformLeagueMembership } from "../../leagueSetup.js";
import type {
  ArchivePlatformLeagueInput,
  RegisterLeagueSeasonInput,
} from "../contracts/league.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";
import { assertRegistrationAllowed } from "./leagueRegistrationGuards.js";

export const createLeagueRegistrationOperations = (context: PlatformAppContext) => ({
  listLeagueMemberships: async (leagueId: string): Promise<readonly PlatformLeagueMembership[]> =>
    cloneForRead(await context.leagueSetup.membershipsForLeague(leagueId)),

  registerLeagueSeason: async (input: RegisterLeagueSeasonInput): Promise<LeagueSeason> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await assertRegistrationAllowed(context, account, input.season, input.memberships);
    const repositoryInput = {
      season: input.season,
      memberships: input.memberships,
      createdByUserId: account.id,
      ...(input.expectedSetupRevision === undefined
        ? {}
        : { expectedSetupRevision: input.expectedSetupRevision }),
      ...(input.membershipWriteMode === undefined
        ? {}
        : { membershipWriteMode: input.membershipWriteMode }),
      ...(input.enforceCreationRateLimit === undefined
        ? {}
        : { enforceCreationRateLimit: input.enforceCreationRateLimit }),
      now: input.now,
    };
    const registered = input.leagueConnectionId !== undefined &&
        context.leagueSetup.registerLeagueSeasonWithConnection !== undefined
      ? await context.leagueSetup.registerLeagueSeasonWithConnection(
        repositoryInput,
        input.leagueConnectionId,
      )
      : await context.leagueSetup.registerLeagueSeason(repositoryInput);
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
