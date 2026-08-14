import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { Owner } from "../../../config/league.js";
import type { DraftRoomRanking } from "../../data/draftRoomRankings.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { LiveDraftStrategyKey } from "../../modeling/liveDraftStrategies.js";
import type { PricingConfig } from "../../modeling/basePricing.js";
import type { ProjectionRecord } from "../../projections.js";

export type LiveDraftImportConflictType =
  | "ambiguous-player"
  | "invalid-command"
  | "invalid-import";

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
