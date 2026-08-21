import type { GenericAuctionMockAiTendency } from "../genericAuctionMockEngine.js";

export type ManagerDraftProfileConfidence = "limited" | "established" | "strong";
export type ManagerDraftProfileStarBidding = "low" | "typical" | "high";
export type ManagerDraftProfileTargetPosition = "QB" | "RB" | "WR" | "TE";

export interface ManagerDraftProfileSample {
  seasonCount: number;
  auctionPurchaseCount: number;
  comparablePurchaseCount: number;
}

export interface ManagerDraftProfileReadModel {
  teamId: string;
  status: "insufficient-history" | "ready";
  sample: ManagerDraftProfileSample;
  confidence: ManagerDraftProfileConfidence | null;
  targetPosition: ManagerDraftProfileTargetPosition | null;
  targetLabel: string | null;
  premiumVsLeagueBaselinePercent: number | null;
  starBidding: ManagerDraftProfileStarBidding | null;
}

export interface ManagerDraftProfileSnapshot extends ManagerDraftProfileReadModel {
  aiTendency?: GenericAuctionMockAiTendency | undefined;
}

export const managerDraftProfileReadModel = (
  profile: ManagerDraftProfileSnapshot,
): ManagerDraftProfileReadModel => ({
  teamId: profile.teamId,
  status: profile.status,
  sample: profile.sample,
  confidence: profile.confidence,
  targetPosition: profile.targetPosition,
  targetLabel: profile.targetLabel,
  premiumVsLeagueBaselinePercent: profile.premiumVsLeagueBaselinePercent,
  starBidding: profile.starBidding,
});
