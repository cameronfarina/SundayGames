import type { SeasonMockConfigurationSnapshotState } from "../seasonMockSnapshot.js";
import type { MockDraftModeMetadata, MockDraftResultReference } from "./metadata.js";

export type MockDraftSessionStatus = "setup" | "active" | "completed" | "abandoned";

export interface MockDraftCommand {
  id: string;
  idempotencyKey: string;
  command: string;
  revision: number;
  createdAt: Date;
}

export interface MockDraftSession {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  status: MockDraftSessionStatus;
  draftMode: MockDraftModeMetadata;
  configurationSnapshot: SeasonMockConfigurationSnapshotState;
  revision: number;
  commandLog: readonly MockDraftCommand[];
  latestResultRef: MockDraftResultReference | undefined;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | undefined;
  completedAt: Date | undefined;
  abandonedAt: Date | undefined;
}
