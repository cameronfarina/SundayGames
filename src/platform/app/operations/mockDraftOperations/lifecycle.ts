import type { MockDraftSession } from "../../../mockSessions.js";
import type {
  AbandonPlatformMockDraftSessionInput,
  CompletePlatformMockDraftSessionInput,
  ResetPlatformMockDraftSessionInput,
} from "../../contracts/mockDraft.js";
import type { PlatformAppContext } from "../../context.js";
import { cloneForRead } from "../../shared.js";

const privateSessionFor = async (
  context: PlatformAppContext,
  actorSessionToken: string,
  sessionId: string,
  now: Date,
) => {
  const account = await context.requireAccount(actorSessionToken, now);
  const session = await context.mockDraftSessions.getSession({
    userId: account.id,
    sessionId,
    now,
  });
  await context.requirePrivateTeamContext(account, session);
  return { account, session };
};

export const createMockDraftLifecycleOperations = (context: PlatformAppContext) => ({
  resetMockDraftSession: async (
    input: ResetPlatformMockDraftSessionInput,
  ): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const { account } = await privateSessionFor(
      context,
      input.actorSessionToken,
      input.sessionId,
      now,
    );
    return cloneForRead(await context.mockDraftSessions.resetSession({
      userId: account.id,
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      now,
    }));
  },

  abandonMockDraftSession: async (
    input: AbandonPlatformMockDraftSessionInput,
  ): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const { account } = await privateSessionFor(
      context,
      input.actorSessionToken,
      input.sessionId,
      now,
    );
    return cloneForRead(await context.mockDraftSessions.abandonSession({
      userId: account.id,
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      now,
    }));
  },

  completeMockDraftSession: async (
    input: CompletePlatformMockDraftSessionInput,
  ): Promise<MockDraftSession> => {
    const now = input.now ?? new Date();
    const { account } = await privateSessionFor(
      context,
      input.actorSessionToken,
      input.sessionId,
      now,
    );
    const latestResultRef = await context.requireReadableMockDraftResultReference(
      account,
      input.latestResultRef,
    );
    return cloneForRead(await context.mockDraftSessions.markCompleted({
      userId: account.id,
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      latestResultRef,
      now,
    }));
  },
});
