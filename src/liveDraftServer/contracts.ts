import type http from "node:http";
import type { KeeperDeclaration } from "../../config/keepers.js";
import type { Owner } from "../../config/league.js";
import type { DraftRoomRanking } from "../data/draftRoomRankings.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { RawPlayerNewsItem } from "../data/playerNewsProviderAdapters.js";
import type { LiveDraftSessionStatus } from "../liveDraftSessionStore.js";
import type {
  LiveDraftReadiness,
  LiveDraftState,
} from "../modeling/liveDraft.js";
import type { LiveDraftStrategyKey } from "../modeling/liveDraftStrategies.js";
import type {
  MyExpertAdviceCard,
  MyExpertPlayer,
  buildMyExpertAdvice,
} from "../modeling/myExpert.js";
import type { LeagueSyncProviderStatusReport } from "../modeling/leagueSync.js";
import type { MockBatch, RunMockBatchOptions } from "../modeling/mockBatch.js";
import type { MockResultsReport } from "../modeling/mockResults.js";
import type { MockDraftScript } from "../modeling/mockScript.js";
import type { PricingConfig } from "../modeling/basePricing.js";
import type { ProjectionRecord } from "../projections.js";
import type {
  MockBatchResourceManager,
  MockBatchResourceScope,
} from "../mockBatchResourceManager.js";

export type LiveDraftSessionMode = "real" | "interactive-mock";

export interface LiveDraftSessionDescriptor {
  key: string;
  label: string;
  description: string;
}

export interface LiveDraftModeDescriptor {
  key: LiveDraftSessionMode;
  label: string;
  description: string;
}

export interface DraftNightLockStatus {
  locked: boolean;
  reason?: string;
}

export interface LiveDraftStateResponse extends LiveDraftState {
  draftMode: LiveDraftSessionMode;
  draftModes: readonly LiveDraftModeDescriptor[];
  activeDraftSession: LiveDraftSessionDescriptor;
  draftSessions: readonly LiveDraftSessionDescriptor[];
  draftNightLock: DraftNightLockStatus;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
}

export interface LiveDraftSessionExportBundle {
  version: 1;
  exportedAt: string;
  activeDraftSession: LiveDraftSessionDescriptor;
  draftMode: LiveDraftSessionMode;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
  currentSnapshot: unknown | null;
  backupSnapshot: unknown | null;
  auditLogJsonl: string;
  commandsJson: string;
  commandsCsv: string;
}

export interface MyExpertRecommendation {
  id: string;
  type: MyExpertAdviceCard["type"];
  priority: MyExpertAdviceCard["priority"];
  title: string;
  detail: string;
  players: MyExpertPlayer[];
  suggestedAdds: MyExpertPlayer[];
  suggestedDrops: MyExpertPlayer[];
  reasons: string[];
  actionLabel: string;
  readOnly: true;
  lineup?: MyExpertAdviceCard["lineup"];
}

export interface MyExpertResponse {
  mode: "advice-only";
  readOnly: true;
  generatedAt: string;
  source: { key: string; label: string; readOnly: true; detail: string };
  team: { owner: Owner; rosteredCount: number; rosteredValue: number; players: MyExpertPlayer[] };
  summary: { currentWeek: number; recommendationCount: number; highPriorityCount: number };
  recommendations: MyExpertRecommendation[];
  integrations: LeagueSyncProviderStatusReport[];
  policy: ReturnType<typeof buildMyExpertAdvice>["policy"];
}

export type LiveDraftImportConflictType = "ambiguous-player" | "invalid-command" | "invalid-import";

export interface LiveDraftImportConflictReview {
  title: string;
  importedCount: number;
  issueCount: number;
  issues: Array<{
    index: number;
    input: string;
    type: LiveDraftImportConflictType;
    message: string;
    matchOptions: string[];
  }>;
}

export interface InteractiveMockDraftModule {
  buildInteractiveMockDraftState(options: {
    projections: readonly ProjectionRecord[];
    historicalRecords: readonly HistoricalAuctionRecord[];
    keepers: readonly KeeperDeclaration[];
    commands: readonly string[];
    watchOwner: Owner;
    strategyKey: LiveDraftStrategyKey;
    pricingConfig?: PricingConfig;
    draftRoomRankings?: readonly DraftRoomRanking[];
    seed?: string;
    nominatedPlayer?: string;
    nominatedPrice?: number;
  }): unknown;
  resolveInteractiveMockDraftAction(mockDraft: unknown, action: string): unknown;
}

export type MockBatchRunner = (options: RunMockBatchOptions) => MockBatch;
export type PlayerNewsProvider = () => Promise<readonly RawPlayerNewsItem[]>;

export interface SleeperSyncPreviewRequest { identifier: string; season: string }
export interface SleeperSyncPreviewLeague {
  leagueId: string;
  name: string;
  status?: string;
  season?: string;
  totalRosters?: number;
}
export interface SleeperSyncPreviewResponse {
  provider: "sleeper";
  readOnly: true;
  identifier: string;
  season: string;
  resolvedAs: "league" | "user";
  message: string;
  leagues: SleeperSyncPreviewLeague[];
  user?: { userId: string; username?: string; displayName?: string };
}
export type SleeperSyncPreviewProvider = (
  request: SleeperSyncPreviewRequest,
) => Promise<SleeperSyncPreviewResponse>;

export interface MockBatchJob {
  jobId: string;
  status: "queued" | "running" | "complete" | "failed";
  source?: "batch" | "interactive-complete";
  draftSessionKey: string;
  watchOwner: Owner;
  draftMode?: LiveDraftSessionMode;
  commandCount?: number;
  strategyKey: LiveDraftStrategyKey;
  runStrategyKeys: readonly LiveDraftStrategyKey[];
  script?: MockDraftScript;
  runsPerScenario: number;
  totalRuns: number;
  completedRuns: number;
  percent: number;
  startedAt: string;
  updatedAt: string;
  result?: MockResultsReport;
  error?: string;
}

export interface CreateLiveDraftServerOptions {
  sessionDirectory?: string;
  projections?: readonly ProjectionRecord[];
  keepers?: readonly KeeperDeclaration[];
  historicalRecords?: readonly HistoricalAuctionRecord[];
  draftRoomRankings?: readonly DraftRoomRanking[];
  pricingConfig?: PricingConfig;
  interactiveMockDraft?: InteractiveMockDraftModule;
  mockBatchRunner?: MockBatchRunner;
  playerNewsProvider?: PlayerNewsProvider;
  sleeperSyncPreviewProvider?: SleeperSyncPreviewProvider;
  maxBodyBytes?: number;
  importMaxBodyBytes?: number;
  completedMockBatchJobTtlMs?: number;
  maxCompletedMockBatchJobs?: number;
  mockBatchNow?: () => Date;
  mockBatchResourceManager?: MockBatchResourceManager;
  mockBatchResourceScope?: MockBatchResourceScope;
  legacyMockBatchEnabled?: boolean;
  scratchSessionsEnabled?: boolean;
}

export interface LiveDraftServerApp {
  canDispose?: () => boolean;
  server: http.Server;
}
