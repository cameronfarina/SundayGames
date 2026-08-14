import type { Owner, Position } from "../../../config/league.js";

export type ProfilePosition = "QB" | "RB" | "WR" | "TE";
export type SpecialTeamsPosition = "K" | "DST";
export type HistoricalWeights = Record<number, number>;
export type ProfilePositionSpend = Record<ProfilePosition, number>;

export interface OwnerProfileData {
  owner: Owner;
  openAuctionSpend: ProfilePositionSpend;
  rosterCounts: Record<Position, number>;
  normalSpecialTeamsSpend: number;
  topTwoConcentration: number;
  oneDollarPlayerCount: number;
  averageKeeperCost: number;
}

export interface OwnerProfile extends OwnerProfileData {
  profileLabel: string;
}

export interface LeagueOpenAuctionSpendTargets {
  byPosition: Record<Position, number>;
  total: number;
}
