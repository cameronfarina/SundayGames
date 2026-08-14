import type { Owner } from "../../../config/league.js";

export interface MockDraftScriptTargetMaxBid {
  owner: Owner;
  player: string;
  maxBid: number;
}

export interface MockDraftScriptBuildAround {
  owner: Owner;
  player: string;
  prices: number[];
}

export interface MockDraftScript {
  raw: string;
  label: string;
  buildAround?: MockDraftScriptBuildAround;
  targetMaxBids: MockDraftScriptTargetMaxBid[];
  runsPerScenario?: number;
}
