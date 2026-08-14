import type {
  MockDraftSession,
  StoredMockDraftCommandRetry,
} from "../../mockSessions.js";
import type {
  AbandonPlatformMockDraftSessionInput,
  AppendPlatformMockDraftCommandInput,
  AssertPlatformMockDraftSessionCreationAllowedInput,
  CompletePlatformMockDraftSessionInput,
  CreatePlatformMockDraftSessionInput,
  FindStoredPlatformMockDraftCommandForRetryInput,
  ListPlatformMockDraftSessionsInput,
  ResetPlatformMockDraftSessionInput,
} from "../contracts/mockDraft.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";

export const createMockDraftOperations = (context: PlatformAppContext) => ({
  assertMockDraftSessionCreationAllowed: async (
    input: AssertPlatformMockDraftSessionCreationAllowedInput,
  ): Promise<void> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    await context.requirePrivateTeamContext(account, input);
    context.store.mockDraftSessions.assertCreationAllowed({
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
    return cloneForRead(context.store.mockDraftSessions.createSession({
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
      throw new PlatformAppError("team_claim_required", "Claim your team before viewing private prep.");
    }
    if (
      membership.ownerId !== input.ownerId
      || (input.teamId !== undefined && membership.teamId !== input.teamId)
    ) {
      throw new PlatformAppError("private_team_required", "Private prep can only use your claimed team.");
    }
    return context.store.mockDraftSessions.listSessionsForOwner({
      userId: account.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: input.ownerId,
      teamId: input.teamId,
      now,
    }).map(cloneForRead);
  },

  appendMockDraftCommand: async (
    input: AppendPlatformMockDraftCommandInput,
  ): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    const session = context.store.mockDraftSessions.getSession({
      userId: account.id,
      sessionId: input.sessionId,
      now,
    });
    await context.requirePrivateTeamContext(account, session);
    const latestResultRef = await context.requireReadableMockDraftResultReference(
      account,
      input.latestResultRef,
    );
    return cloneForRead(context.store.mockDraftSessions.appendCommand({
      userId: account.id,
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      expectedCommandCount: input.expectedCommandCount,
      commandId: input.commandId,
      command: input.command,
      idempotencyKey: input.idempotencyKey,
      latestResultRef,
      now,
    }));
  },

  findStoredMockDraftCommandForRetry: async (
    input: FindStoredPlatformMockDraftCommandForRetryInput,
  ): Promise<StoredMockDraftCommandRetry | undefined> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    const session = context.store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId, now });
    await context.requirePrivateTeamContext(account, session);
    const retry = context.store.mockDraftSessions.findStoredCommandForRetry({
      userId: account.id,
      sessionId: input.sessionId,
      commandId: input.commandId,
      command: input.command,
      idempotencyKey: input.idempotencyKey,
      now,
    });
    return retry === undefined ? undefined : cloneForRead(retry);
  },

  resetMockDraftSession: async (input: ResetPlatformMockDraftSessionInput): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    const session = context.store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId, now });
    await context.requirePrivateTeamContext(account, session);
    return cloneForRead(context.store.mockDraftSessions.resetSession({
      userId: account.id, sessionId: input.sessionId, expectedRevision: input.expectedRevision, now,
    }));
  },

  abandonMockDraftSession: async (input: AbandonPlatformMockDraftSessionInput): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    const session = context.store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId, now });
    await context.requirePrivateTeamContext(account, session);
    return cloneForRead(context.store.mockDraftSessions.abandonSession({
      userId: account.id, sessionId: input.sessionId, expectedRevision: input.expectedRevision, now,
    }));
  },

  completeMockDraftSession: async (
    input: CompletePlatformMockDraftSessionInput,
  ): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const account = await context.requireAccount(input.actorSessionToken, now);
    const session = context.store.mockDraftSessions.getSession({ userId: account.id, sessionId: input.sessionId, now });
    await context.requirePrivateTeamContext(account, session);
    const latestResultRef = await context.requireReadableMockDraftResultReference(account, input.latestResultRef);
    return cloneForRead(context.store.mockDraftSessions.markCompleted({
      userId: account.id,
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      latestResultRef,
      now,
    }));
  },
});
