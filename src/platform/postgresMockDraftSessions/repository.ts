import type {
  AbandonMockDraftSessionInput,
  AppendMockDraftCommandInput,
  AssertMockDraftSessionCreationAllowedInput,
  CreateMockDraftSessionInput,
  FindStoredMockDraftCommandForRetryInput,
  GetMockDraftSessionInput,
  ListMockDraftSessionsForOwnerInput,
  MarkMockDraftSessionCompletedInput,
  MockDraftSession,
  MockDraftSessionRepository,
  MockDraftSessionResourcePolicy,
  ResetMockDraftSessionInput,
  StoredMockDraftCommandRetry,
} from "../mockSessions.js";
import { InMemoryMockDraftSessionRepository } from "../mockSessions.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { runWithMockDraftSessionState } from "./state.js";

type MirrorUserMockDraftSessions = (
  userId: string,
  sessions: readonly MockDraftSession[],
) => void;

export class PostgresMockDraftSessionRepository implements MockDraftSessionRepository {
  readonly #client: PostgresTransactionalQueryClient;
  readonly #resourcePolicy: Partial<MockDraftSessionResourcePolicy>;
  readonly #mirrorUserSessions: MirrorUserMockDraftSessions;

  constructor(
    client: PostgresTransactionalQueryClient,
    resourcePolicy: Partial<MockDraftSessionResourcePolicy> = {},
    mirrorUserSessions: MirrorUserMockDraftSessions = () => undefined,
  ) {
    this.#client = client;
    this.#resourcePolicy = resourcePolicy;
    this.#mirrorUserSessions = mirrorUserSessions;
  }

  async createSession(input: CreateMockDraftSessionInput): Promise<MockDraftSession> {
    return await this.#run(
      input.userId,
      repository => repository.createSession(input),
      undefined,
      true,
    );
  }

  async assertCreationAllowed(input: AssertMockDraftSessionCreationAllowedInput): Promise<void> {
    await this.#run(input.userId, repository => repository.assertCreationAllowed(input));
  }

  async getSession(input: GetMockDraftSessionInput): Promise<MockDraftSession> {
    return await this.#run(
      input.userId,
      repository => repository.getSession(input),
      input.sessionId,
    );
  }

  async listSessionsForOwner(
    input: ListMockDraftSessionsForOwnerInput,
  ): Promise<readonly MockDraftSession[]> {
    return await this.#run(input.userId, repository => repository.listSessionsForOwner(input));
  }

  async appendCommand(input: AppendMockDraftCommandInput): Promise<MockDraftSession> {
    return await this.#run(
      input.userId,
      repository => repository.appendCommand(input),
      input.sessionId,
      true,
    );
  }

  async findStoredCommandForRetry(
    input: FindStoredMockDraftCommandForRetryInput,
  ): Promise<StoredMockDraftCommandRetry | undefined> {
    return await this.#run(
      input.userId,
      repository => repository.findStoredCommandForRetry(input),
      input.sessionId,
      true,
    );
  }

  async markCompleted(input: MarkMockDraftSessionCompletedInput): Promise<MockDraftSession> {
    return await this.#run(
      input.userId,
      repository => repository.markCompleted(input),
      input.sessionId,
      true,
    );
  }

  async resetSession(input: ResetMockDraftSessionInput): Promise<MockDraftSession> {
    return await this.#run(
      input.userId,
      repository => repository.resetSession(input),
      input.sessionId,
      true,
    );
  }

  async abandonSession(input: AbandonMockDraftSessionInput): Promise<MockDraftSession> {
    return await this.#run(
      input.userId,
      repository => repository.abandonSession(input),
      input.sessionId,
      true,
    );
  }

  async #run<T>(
    userId: string,
    operation: (repository: InMemoryMockDraftSessionRepository) => T,
    sessionId?: string,
    mirror = false,
  ): Promise<T> {
    const committed = await this.#client.transaction(async client =>
      await runWithMockDraftSessionState(
        client,
        userId,
        this.#resourcePolicy,
        operation,
        sessionId,
      )
    );
    if (mirror) this.#mirrorUserSessions(userId, committed.sessions);
    return committed.result;
  }
}
