import type { Owner, Position } from "../../../config/league.js";
import type { StarterSlot } from "../../types.js";

export type MockResultsPlayerSlot = StarterSlot | "BENCH";

export interface MockResultsPlayer {
  name: string;
  position: Position;
  slot: MockResultsPlayerSlot;
  price: number;
  week1: number;
  weeks1To4: number;
  seasonProjection: number;
  starter: boolean;
}

export interface MockResultsTeam {
  owner: Owner;
  spend: number;
  budgetRemaining: number;
  week1Score: number;
  weeks1To4Score: number;
  starterSeasonScore: number;
  depthScore: number;
  consistencyScore: number;
  seasonStrengthScore: number;
  valid: boolean;
  errors: string[];
  starters: MockResultsPlayer[];
  bench: MockResultsPlayer[];
  players: MockResultsPlayer[];
  projectedRank?: number;
  projectedFinishLabel?: string;
  rankExplanation?: string;
  topStarter?: MockResultsPlayer;
  bestValue?: MockResultsPlayer;
  corePlayers?: MockResultsPlayer[];
  strengths?: string[];
  risks?: string[];
}

export interface MockResultsRanking {
  rank: number;
  owner: Owner;
  week1Score: number;
  weeks1To4Score: number;
  week1Rank: number;
  starterSeasonScore: number;
  depthScore: number;
  consistencyScore: number;
  seasonStrengthScore: number;
  projectedFinishScore: number;
  projectedFinishLabel: string;
  explanation: string;
  strengths: string[];
  risks: string[];
}

export interface MockResultsBuildSummary {
  owner: Owner;
  rank: number;
  headline: string;
  week1Score: number;
  weeks1To4Score: number;
  seasonStrengthScore: number;
  spend: number;
  budgetRemaining: number;
  corePlayers: string[];
}

export interface MockResultsCamOutcome extends MockResultsBuildSummary {
  week1Rank: number;
  strengths: string[];
  risks: string[];
}
