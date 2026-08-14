import type {
  PositionBalanceDetail,
  ProjectedRosterPlayerContribution,
  ProjectedStarterContribution,
} from "./contracts/ranking.js";

export interface StarterSelection {
  projectedPoints: number;
  selectedPlayerIndexes: ReadonlySet<number>;
  filledSlots: number;
  lineup: readonly ProjectedStarterContribution[];
}

export interface TeamComponentValues {
  teamId: string;
  starterProjectedPoints: number;
  filledSlots: number;
  starterLineup: readonly ProjectedStarterContribution[];
  benchProjectedPoints: number;
  countedBenchPlayers: number;
  benchPlayers: readonly ProjectedRosterPlayerContribution[];
  positionalBalanceScore: number;
  positionDetails: readonly PositionBalanceDetail[];
}

export interface RankedTeam extends TeamComponentValues {
  starterRank: number;
  starterNormalizedScore: number;
  benchRank: number;
  benchNormalizedScore: number;
  balanceRank: number;
  balanceNormalizedScore: number;
  overallScore: number;
  overallRank: number;
}
