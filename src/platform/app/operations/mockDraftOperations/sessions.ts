import type { MockDraftSession } from "../../../mockSessions.js";
import type {
  AssertPlatformMockDraftSessionCreationAllowedInput,
  CreatePlatformMockDraftSessionInput,
  ListPlatformMockDraftSessionsInput,
} from "../../contracts/mockDraft.js";
import type { PlatformAppContext } from "../../context.js";
import { PlatformAppError } from "../../errors.js";
import { cloneForRead } from "../../shared.js";

export const createMockDraftSessionOperations = (context: PlatformAppContext) => ({
  assertMockDraftSessionCreationAllowed: async (
    input: AssertPlatformMockDraftSessionCreationAllowedInput,
  ): Promise<void> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    await context.requirePrivateTeamContext(account, input);
    await context.mockDraftSessions.assertCreationAllowed({
      userId: account.id,
      seasonId: input.seasonId,
      now,
    });
  },

  createMockDraftSession: async (
    input: CreatePlatformMockDraftSessionInput,
  ): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    await context.requirePrivateTeamContext(account, input);
    return cloneForRead(await context.mockDraftSessions.createSession({
      userId: account.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: input.ownerId,
      teamId: input.teamId,
      draftMode: input.draftMode,
      configurationSnapshot: input.configurationSnapshot,
      status: input.status,
      now,
    }));
  },

  listMockDraftSessions: async (
    input: ListPlatformMockDraftSessionsInput,
  ): Promise<readonly MockDraftSession[]> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    const season = await context.requireSeason(input.seasonId);
    const membership = await context.requireSharedRead(account, input.leagueId);
    if (season.leagueId !== input.leagueId) {
      throw new PlatformAppError("league_not_found", "League does not match this season.");
    }
    if (membership.ownerId === undefined) {
      throw new PlatformAppError(
        "team_claim_required",
        "Claim your team before viewing private prep.",
      );
    }
    if (
      membership.ownerId !== input.ownerId
      || (input.teamId !== undefined && membership.teamId !== input.teamId)
    ) {
      throw new PlatformAppError(
        "private_team_required",
        "Private prep can only use your claimed team.",
      );
    }
    return (await context.mockDraftSessions.listSessionsForOwner({
      userId: account.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: input.ownerId,
      teamId: input.teamId,
      now,
    })).map(cloneForRead);
  },
});
