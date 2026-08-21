import type { SeasonMockConfigurationSnapshotV2 } from "../seasonMockSnapshot.js";
import type { MockDraftModeMetadata, MockDraftResultReference } from "./metadata.js";
import type { MockDraftCommand, MockDraftSession, MockDraftSessionStatus } from "./session.js";

export interface CreateMockDraftSessionInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  draftMode: MockDraftModeMetadata;
  configurationSnapshot?: SeasonMockConfigurationSnapshotV2 | undefined;
  status?: Extract<MockDraftSessionStatus, "setup" | "active"> | undefined;
  now?: Date | undefined;
}

export interface AssertMockDraftSessionCreationAllowedInput {
  userId: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface AssertActiveMockDraftSessionCapacityInput {
  userId: string;
  seasonId: string;
  excludeSessionId?: string | undefined;
}

export interface GetMockDraftSessionInput {
  userId: string;
  sessionId: string;
  now?: Date | undefined;
}

export interface ListMockDraftSessionsForOwnerInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId?: string | undefined;
  now?: Date | undefined;
}

export interface AppendMockDraftCommandInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  expectedCommandCount: number;
  commandId: string;
  command: string;
  idempotencyKey?: string | undefined;
  completeSession?: boolean | undefined;
  latestResultRef?: MockDraftResultReference | undefined;
  now?: Date | undefined;
}

export interface FindStoredMockDraftCommandForRetryInput {
  userId: string;
  sessionId: string;
  commandId: string;
  command: string;
  idempotencyKey?: string | undefined;
  now?: Date | undefined;
}

export interface StoredMockDraftCommandRetry {
  session: MockDraftSession;
  command: MockDraftCommand;
}

export interface MarkMockDraftSessionCompletedInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  latestResultRef?: MockDraftResultReference | undefined;
  now?: Date | undefined;
}

export interface ResetMockDraftSessionInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  now?: Date | undefined;
}

export interface AbandonMockDraftSessionInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  now?: Date | undefined;
}
