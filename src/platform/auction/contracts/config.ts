export interface GenericAuctionMockAiTendency {
  bidMultiplier?: number | undefined;
  positionBidMultipliers?: Readonly<Record<string, number>> | undefined;
  nominationPositionWeights?: Readonly<Record<string, number>> | undefined;
  randomness?: number | undefined;
}

export interface GenericAuctionMockTeamConfig {
  id: string;
  name: string;
  aiTendency?: GenericAuctionMockAiTendency | undefined;
}

export interface GenericAuctionMockRosterSlotConfig {
  slot: string;
  count: number;
  eligiblePositions: readonly string[];
}

export interface GenericAuctionMockPlayer {
  id: string;
  name: string;
  position: string;
  expectedPrice: number;
  humanValue?: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
  weeks1To4Projection?: number | undefined;
  seasonProjection?: number | undefined;
  starterEligible?: boolean | undefined;
  projectedStarter?: boolean | undefined;
}

export interface GenericAuctionMockKeeper {
  teamId: string;
  playerId: string;
  price: number;
}

export interface GenericAuctionMockPlannedAcquisition {
  teamId: string;
  playerId: string;
  price: number;
}

export interface GenericAuctionMockAiConfig {
  defaultBidMultiplier?: number | undefined;
  rosterNeedDollars?: number | undefined;
  randomness?: number | undefined;
  bidPressureExemptPlayerIds?: readonly string[] | undefined;
}

export interface GenericAuctionMockConfig {
  sessionId: string;
  seed: string;
  humanTeamId: string;
  budgetDollars: number;
  minimumBidDollars: number;
  teams: readonly GenericAuctionMockTeamConfig[];
  rosterSlots: readonly GenericAuctionMockRosterSlotConfig[];
  positionMaximums: Readonly<Record<string, number>>;
  players: readonly GenericAuctionMockPlayer[];
  keepers?: readonly GenericAuctionMockKeeper[] | undefined;
  plannedAcquisitions?: readonly GenericAuctionMockPlannedAcquisition[] | undefined;
  ai?: GenericAuctionMockAiConfig | undefined;
}
