import type { Position } from "../../../../config/league.js";

export interface AuctionNominationScoreComponents {
  marketPrice: number;
  projection: number;
  ownerNeed: number;
  opponentNeed: number;
  affordability: number;
  scarcity: number;
  flushMoney: number;
  tieBreak: number;
}

export interface AuctionNominationCandidateDiagnostics {
  rank: number;
  player: string;
  position: Position;
  marketPrice: number;
  projectionTotal: number;
  score: number;
  scoreComponents: AuctionNominationScoreComponents;
  weightedComponents: AuctionNominationScoreComponents;
}

export interface AuctionNominationDiagnostics {
  selectedPlayer: string;
  selectedPosition: Position;
  selectedScore: number;
  candidateCount: number;
  topCandidates: AuctionNominationCandidateDiagnostics[];
}
