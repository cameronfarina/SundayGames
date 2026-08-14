import type http from "node:http";
import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { DraftRoomRanking } from "../../data/draftRoomRankings.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { PricingConfig } from "../../modeling/basePricing.js";
import type { ProjectionRecord } from "../../projections.js";
import type {
  MockBatchResourceManager,
  MockBatchResourceScope,
} from "../../mockBatchResourceManager.js";
import type { MockBatchRunner, PlayerNewsProvider } from "./batch.js";
import type { InteractiveMockDraftModule } from "./imports.js";
import type { SleeperSyncPreviewProvider } from "./sleeper.js";

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
