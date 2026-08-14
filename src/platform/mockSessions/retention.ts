import type { MockDraftSessionResourcePolicy } from "./resourcePolicy.js";
import type { MockDraftSession } from "./session.js";
import type { MockDraftSessionRepositoryState } from "./state.js";

interface MockDraftSessionRetention {
  anchor: Date;
  durationMs: number;
}

const retentionForSession = (
  session: MockDraftSession,
  policy: MockDraftSessionResourcePolicy,
): MockDraftSessionRetention | undefined => {
  switch (session.status) {
    case "abandoned":
      return {
        anchor: session.abandonedAt ?? session.updatedAt,
        durationMs: policy.abandonedRetentionMs,
      };
    case "completed":
      return {
        anchor: session.completedAt ?? session.updatedAt,
        durationMs: policy.completedRetentionMs,
      };
    case "active":
    case "setup":
      return undefined;
  }
};

export const pruneExpiredMockDraftSessions = (
  state: MockDraftSessionRepositoryState,
  now: Date,
): void => {
  for (const [sessionId, storedSession] of state.sessionsById) {
    let session = storedSession;
    if (
      (session.status === "setup" || session.status === "active")
      && session.updatedAt.getTime() + state.resourcePolicy.inactiveSessionTtlMs <= now.getTime()
    ) {
      const abandonedAt = new Date(
        session.updatedAt.getTime() + state.resourcePolicy.inactiveSessionTtlMs,
      );
      session = { ...session, status: "abandoned", abandonedAt, updatedAt: abandonedAt };
      state.sessionsById.set(sessionId, session);
    }
    const retention = retentionForSession(session, state.resourcePolicy);
    if (retention !== undefined && retention.anchor.getTime() + retention.durationMs <= now.getTime()) {
      state.sessionsById.delete(sessionId);
    }
  }
};
