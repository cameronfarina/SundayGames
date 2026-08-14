import type { PlayerNewsAvailabilityStatus } from "./categoryContracts.js";

export interface PlayerNewsDraftTarget {
  name: string;
  normalizedPlayerName?: string;
  position: string;
  teamAbbreviation?: string;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  valueScore: number;
  tags?: readonly string[];
}

export interface PlayerNewsPlayerMetadata {
  name: string;
  normalizedPlayerName?: string;
  position: string;
  teamAbbreviation?: string;
}

export interface PlayerNewsDraftEvent {
  player: string;
  normalizedPlayerName?: string;
  owner: string;
  price: number;
}

export interface PlayerNewsRosterPlayer {
  name: string;
  position: string;
  teamAbbreviation?: string;
  price: number;
  source: string;
}

export interface PlayerNewsOwnerState {
  owner: string;
  roster: readonly PlayerNewsRosterPlayer[];
}

export interface PlayerNewsDraftState {
  availableTargets: readonly PlayerNewsDraftTarget[];
  events: readonly PlayerNewsDraftEvent[];
  owners: readonly PlayerNewsOwnerState[];
}

export interface PlayerNewsAuctionSnapshot {
  status: PlayerNewsAvailabilityStatus;
  expectedPrice?: number;
  liveExpectedPrice?: number;
  personalValue?: number;
  recommendedMaxBid?: number;
  valueScore?: number;
  tags: string[];
}

export interface PlayerNewsAvailability {
  status: PlayerNewsAvailabilityStatus;
  detail: string;
}
