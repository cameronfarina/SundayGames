import type {
  MockDraftSession,
  StoredMockDraftCommandRetry,
} from "../../../mockSessions.js";
import type {
  AppendPlatformMockDraftCommandInput,
  FindStoredPlatformMockDraftCommandForRetryInput,
} from "../../contracts/mockDraft.js";
import type { PlatformAppContext } from "../../context.js";
import { cloneForRead } from "../../shared.js";

export const createMockDraftCommandOperations = (context: PlatformAppContext) => ({
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
    const session = context.store.mockDraftSessions.getSession({
      userId: account.id,
      sessionId: input.sessionId,
      now,
    });
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
});
