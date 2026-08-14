import type { IncomingMessage, ServerResponse } from "node:http";
import type { KeeperDeclaration } from "../../config/keepers.js";
import type { Owner } from "../../config/league.js";
import type { DraftRoomRanking } from "../data/draftRoomRankings.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { FileBackedLiveDraftSessionStore } from "../liveDraftSessionStore.js";
import type { LiveDraftStrategyKey } from "../modeling/liveDraftStrategies.js";
import type { MockBatch } from "../modeling/mockBatch.js";
import type { MockResultsReport } from "../modeling/mockResults.js";
import type { PlayerNewsFeed } from "../modeling/playerNews.js";
import type { PricingConfig } from "../modeling/basePricing.js";
import type { ProjectionRecord } from "../projections.js";
import type {
  CreateLiveDraftServerOptions,
  LiveDraftSessionExportBundle,
  LiveDraftSessionMode,
  LiveDraftStateResponse,
  MockBatchJob,
  MyExpertResponse,
} from "./contracts.js";

export interface LiveDraftData {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  draftRoomRankings: readonly DraftRoomRanking[];
  pricingConfig: PricingConfig;
  configuredKeepers: readonly KeeperDeclaration[];
}

export interface StoreService {
  storeFor(
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
  ): Promise<FileBackedLiveDraftSessionStore>;
  runQueuedMutation<T>(
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
    mutation: () => Promise<T>,
  ): Promise<T>;
}

export interface StateRequest {
  draftSessionKey?: string;
  mode?: LiveDraftSessionMode;
  commands?: readonly string[];
  strategyKey?: LiveDraftStrategyKey;
  watchOwner?: Owner;
}

export interface StateService {
  stateFor(request?: StateRequest): Promise<LiveDraftStateResponse>;
  myExpertFor(url: URL): Promise<MyExpertResponse>;
  playerNewsFor(url: URL): Promise<PlayerNewsFeed>;
  exportBundleFor(request: {
    draftSessionKey: string;
    mode: LiveDraftSessionMode;
    strategyKey: LiveDraftStrategyKey;
  }): Promise<LiveDraftSessionExportBundle>;
}

export interface MockDraftRequest {
  draftSessionKey?: string;
  watchOwner?: Owner;
  commands?: readonly string[];
  strategyKey: LiveDraftStrategyKey;
  seed?: string;
  nominatedPlayer?: string;
  nominatedPrice?: number;
}

export interface InteractiveMockService {
  mockDraftFor(request: MockDraftRequest): Promise<unknown>;
  stateWithMockDraft(request: MockDraftRequest): Promise<LiveDraftStateResponse & { mockDraft: unknown }>;
  runSpeedAction(request: MockDraftRequest & { action: string }): Promise<{
    status: number;
    body: LiveDraftStateResponse & {
      mockDraft: unknown;
      mockBatchJob?: MockBatchJob;
      errors?: { input: string; message: string }[];
    };
  }>;
  interactiveBatchForCommands(request: {
    draftSessionKey: string;
    watchOwner: Owner;
    strategyKey: LiveDraftStrategyKey;
    commands: readonly string[];
    seed?: string;
  }): Promise<MockBatch>;
}

export interface BatchService {
  latestCompleteReport(draftSessionKey: string, watchOwner: Owner): MockResultsReport | undefined;
  publishInteractiveResults(request: {
    draftSessionKey: string;
    watchOwner: Owner;
    strategyKey: LiveDraftStrategyKey;
    commandCount: number;
    batch: MockBatch;
  }): MockBatchJob;
  responseFor(job: MockBatchJob): MockBatchJob;
  start(request: {
    draftSessionKey: string;
    watchOwner: Owner;
    strategyKey: LiveDraftStrategyKey;
    runsPerScenario: number;
    seedPrefix: string;
    script?: import("../modeling/mockScript.js").MockDraftScript;
  }): MockBatchJob;
  latestJob(draftSessionKey: string, watchOwner: Owner): MockBatchJob | undefined;
  job(jobId: string): MockBatchJob | undefined;
  prune(): void;
  canDispose(): boolean;
}

export interface RouteContext {
  options: CreateLiveDraftServerOptions;
  data: LiveDraftData;
  stores: StoreService;
  state: StateService;
  interactive: InteractiveMockService;
  batches: BatchService;
  maxBodyBytes: number;
  importMaxBodyBytes: number;
  legacyMockBatchEnabled: boolean;
  enabledDraftSessionKeyFromQuery(url: URL, fallback?: string): string;
  enabledDraftSessionKeyFromBody(body: Record<string, unknown>, fallback?: string): string;
  bodyLimitForPath(pathname: string): number;
}

export interface RouteRequest {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  context: RouteContext;
}

export type RouteHandler = (request: RouteRequest) => Promise<boolean>;
