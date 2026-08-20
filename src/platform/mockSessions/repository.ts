import {
  getMockDraftSession,
  listMockDraftSessionsForOwner,
} from "./access.js";
import {
  assertMockDraftSessionCreationAllowed,
} from "./capacity.js";
import {
  appendMockDraftCommand,
  findStoredMockDraftCommandForRetry,
} from "./commands.js";
import { createMockDraftSession } from "./createSession.js";
import type {
  AbandonMockDraftSessionInput,
  AppendMockDraftCommandInput,
  AssertMockDraftSessionCreationAllowedInput,
  CreateMockDraftSessionInput,
  FindStoredMockDraftCommandForRetryInput,
  GetMockDraftSessionInput,
  ListMockDraftSessionsForOwnerInput,
  MarkMockDraftSessionCompletedInput,
  ResetMockDraftSessionInput,
  StoredMockDraftCommandRetry,
} from "./inputs.js";
import {
  abandonMockDraftSession,
  completeMockDraftSession,
  resetMockDraftSession,
} from "./lifecycle.js";
import {
  listStoredMockDraftSessions,
  replaceStoredMockDraftSessions,
} from "./persistence.js";
import {
  defaultMockDraftSessionResourcePolicy,
  type MockDraftSessionResourcePolicy,
} from "./resourcePolicy.js";
import type { MockDraftSessionRepository } from "./repositoryContracts.js";
import type { MockDraftSession } from "./session.js";
import type { MockDraftSessionRepositoryState } from "./state.js";

export class InMemoryMockDraftSessionRepository implements MockDraftSessionRepository {
  readonly #state: MockDraftSessionRepositoryState;

  constructor(
    sessions: readonly MockDraftSession[] = [],
    resourcePolicy: Partial<MockDraftSessionResourcePolicy> = {},
  ) {
    this.#state = {
      sessionsById: new Map<string, MockDraftSession>(),
      resourcePolicy: { ...defaultMockDraftSessionResourcePolicy, ...resourcePolicy },
    };
    this.replaceSessions(sessions);
  }

  createSession(input: CreateMockDraftSessionInput): MockDraftSession {
    const now = input.now ?? new Date();
    this.assertCreationAllowed({ userId: input.userId, seasonId: input.seasonId, now });
    return createMockDraftSession(this.#state, { ...input, now });
  }

  assertCreationAllowed(input: AssertMockDraftSessionCreationAllowedInput): void {
    assertMockDraftSessionCreationAllowed(this.#state, input);
  }

  getSession(input: GetMockDraftSessionInput): MockDraftSession {
    return getMockDraftSession(this.#state, input);
  }

  listSessionsForOwner(
    input: ListMockDraftSessionsForOwnerInput,
  ): readonly MockDraftSession[] {
    return listMockDraftSessionsForOwner(this.#state, input);
  }

  appendCommand(input: AppendMockDraftCommandInput): MockDraftSession {
    return appendMockDraftCommand(
      this.#state,
      input,
      retryInput => this.findStoredCommandForRetry(retryInput),
    );
  }

  findStoredCommandForRetry(
    input: FindStoredMockDraftCommandForRetryInput,
  ): StoredMockDraftCommandRetry | undefined {
    return findStoredMockDraftCommandForRetry(this.#state, input);
  }

  markCompleted(input: MarkMockDraftSessionCompletedInput): MockDraftSession {
    return completeMockDraftSession(this.#state, input);
  }

  resetSession(input: ResetMockDraftSessionInput): MockDraftSession {
    return resetMockDraftSession(this.#state, input);
  }

  abandonSession(input: AbandonMockDraftSessionInput): MockDraftSession {
    return abandonMockDraftSession(this.#state, input);
  }

  sessions(now?: Date): readonly MockDraftSession[] {
    return listStoredMockDraftSessions(this.#state, now);
  }

  replaceSessions(sessions: readonly MockDraftSession[]): void {
    replaceStoredMockDraftSessions(this.#state, sessions);
  }

  replaceSessionsForUser(
    userId: string,
    sessions: readonly MockDraftSession[],
  ): void {
    const retained = this.sessions().filter(session => session.userId !== userId);
    this.replaceSessions([...retained, ...sessions]);
  }
}
