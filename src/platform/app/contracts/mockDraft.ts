import type {
  AppendMockDraftCommandInput,
  FindStoredMockDraftCommandForRetryInput,
  MockDraftModeMetadata,
  MockDraftResultReference,
} from "../../mockSessions.js";
import type { SeasonMockConfigurationSnapshotV2 } from "../../seasonMockSnapshot.js";
import type { PrivateTeamContextInput } from "./league.js";

export interface CreatePlatformMockDraftSessionInput extends PrivateTeamContextInput {
  draftMode: MockDraftModeMetadata;
  configurationSnapshot?: SeasonMockConfigurationSnapshotV2 | undefined;
  status?: "setup" | "active" | undefined;
}

export interface AssertPlatformMockDraftSessionCreationAllowedInput extends PrivateTeamContextInput {}

export interface ListPlatformMockDraftSessionsInput {
  actorSessionToken: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId?: string | undefined;
  now?: Date | undefined;
}

export interface AppendPlatformMockDraftCommandInput extends Omit<
  AppendMockDraftCommandInput,
  "userId" | "now"
> {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface FindStoredPlatformMockDraftCommandForRetryInput extends Omit<
  FindStoredMockDraftCommandForRetryInput,
  "userId"
> {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface ResetPlatformMockDraftSessionInput {
  actorSessionToken: string;
  sessionId: string;
  expectedRevision: number;
  now?: Date | undefined;
}

export interface AbandonPlatformMockDraftSessionInput extends ResetPlatformMockDraftSessionInput {}

export interface CompletePlatformMockDraftSessionInput extends ResetPlatformMockDraftSessionInput {
  latestResultRef?: MockDraftResultReference | undefined;
}
