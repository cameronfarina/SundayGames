import type { Position } from "../../../config/league.js";

export interface EspnPpr300AuctionBaselineValue {
  overallRank: number;
  position: Position;
  positionRank: number;
  name: string;
  normalizedName: string;
  teamAbbreviation: string;
  auctionValue: number;
  byeWeek: number;
}

export interface EspnPpr300AuctionBaselineRoster {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  DST: number;
  BENCH: number;
}

export interface EspnPpr300AuctionBaselineSource {
  provider: "ESPN";
  title: string;
  url: string;
  lastUpdated: string;
  scoring: "ppr";
  receptionPoints: number;
  teamCount: number;
  salaryCap: number;
  roster: Readonly<EspnPpr300AuctionBaselineRoster>;
}
