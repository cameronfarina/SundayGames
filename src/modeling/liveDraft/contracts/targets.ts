import type { KeeperStatus } from "../../../../config/keepers.js";
import type { Owner, Position } from "../../../../config/league.js";
import type { DraftRoomRanking } from "../../../data/draftRoomRankings.js";
import type { LiveDraftStrategyKey } from "../../liveDraftStrategies.js";
import type { LiveDraftPlayerSource } from "./playerSource.js";
import type { LiveDraftReadinessStatus } from "./readiness.js";

interface LiveDraftTargetProjection {
  name: string;
  position: Position;
  teamAbbreviation?: string;
  byeWeek?: number;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  valueScore: number;
  week1Projection: number;
  weeks1To4: number;
  seasonProjection: number;
  projectionRank?: number;
  espnRank?: number;
  draftRoomRank?: DraftRoomRanking;
  tags: string[];
}

export interface LiveDraftTarget extends LiveDraftTargetProjection {
  strategyValues: Record<LiveDraftStrategyKey, number>;
  source: LiveDraftPlayerSource;
}

export interface LiveDraftKeeperTarget extends LiveDraftTargetProjection {
  keeperOwner: Owner;
  keeperCost: number;
  keeperStatus: KeeperStatus;
  draftable: false;
}

export type LiveDraftPathBandStatus = "filled" | "next" | "open";

export interface LiveDraftPathPriceBand {
  slot: string;
  position: Position;
  minimumPrice: number;
  maximumPrice: number;
  status: LiveDraftPathBandStatus;
  note: string;
  filledBy?: string;
}

export interface LiveDraftPathTargetCluster {
  label: string;
  position: Position;
  targetNames: string[];
  priceBand: string;
  note: string;
}

export interface LiveDraftPathPivotRule {
  label: string;
  trigger: string;
  action: string;
}

export interface LiveDraftPathRiskAlert {
  label: string;
  status: LiveDraftReadinessStatus;
  detail: string;
}

export interface LiveDraftPathRecommendation {
  strategyKey: LiveDraftStrategyKey;
  label: string;
  summary: string;
  maxPriceBands: LiveDraftPathPriceBand[];
  targetClusters: LiveDraftPathTargetCluster[];
  pivotRules: LiveDraftPathPivotRule[];
  riskAlerts: LiveDraftPathRiskAlert[];
  deadZoneWarnings: string[];
}

export interface LiveDraftShortlistTarget {
  name: string;
  position: Position;
  teamAbbreviation?: string;
  byeWeek?: number;
  liveExpectedPrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  valueGap: number;
  valueScore: number;
  reasons: string[];
}

export interface LiveDraftPositionContext {
  position: "RB" | "WR" | "TE";
  ownersNeeding: Owner[];
  blockers: Owner[];
  strongestBlockerMaxBid: number;
}
