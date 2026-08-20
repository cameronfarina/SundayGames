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
import type { MockDraftSession } from "./session.js";

type MaybePromise<T> = T | Promise<T>;

export interface MockDraftSessionRepository {
  createSession(input: CreateMockDraftSessionInput): MaybePromise<MockDraftSession>;
  assertCreationAllowed(input: AssertMockDraftSessionCreationAllowedInput): MaybePromise<void>;
  getSession(input: GetMockDraftSessionInput): MaybePromise<MockDraftSession>;
  listSessionsForOwner(
    input: ListMockDraftSessionsForOwnerInput,
  ): MaybePromise<readonly MockDraftSession[]>;
  appendCommand(input: AppendMockDraftCommandInput): MaybePromise<MockDraftSession>;
  findStoredCommandForRetry(
    input: FindStoredMockDraftCommandForRetryInput,
  ): MaybePromise<StoredMockDraftCommandRetry | undefined>;
  markCompleted(input: MarkMockDraftSessionCompletedInput): MaybePromise<MockDraftSession>;
  resetSession(input: ResetMockDraftSessionInput): MaybePromise<MockDraftSession>;
  abandonSession(input: AbandonMockDraftSessionInput): MaybePromise<MockDraftSession>;
}
