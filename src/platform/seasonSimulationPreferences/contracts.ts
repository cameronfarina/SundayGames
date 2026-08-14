import type { LeagueSeason, LeagueSeasonSettings } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms/contracts/core.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups/contracts.js";

export interface SeasonSimulationPreferredPosition {
  position: "QB" | "RB" | "WR" | "TE";
  tier: "elite";
  targetCount?: number | undefined;
  maxAuctionPrice?: number | undefined;
}

export interface SeasonSimulationPreferenceRule {
  basis: "auction_expected_value" | "snake_catalog_rank";
  positionRankMaximum: number;
  qualifyingPlayerIds: readonly string[];
  minimumExpectedValue?: number | undefined;
}

export interface SeasonSimulationPreferenceOutcome {
  position: SeasonSimulationPreferredPosition["position"];
  tier: SeasonSimulationPreferredPosition["tier"];
  targetCount: number;
  status: "hit" | "miss" | "infeasible";
  feasible: boolean;
  hitCount: number;
  hitRate: number;
  rule: SeasonSimulationPreferenceRule;
  message: string;
}

export interface ResolvedSeasonSimulationPreference {
  preference: SeasonSimulationPreferredPosition;
  targetCount: number;
  rule: SeasonSimulationPreferenceRule;
  feasible: boolean;
}

export interface ResolveSeasonSimulationPreferencesInput {
  preferences: readonly SeasonSimulationPreferredPosition[];
  season: LeagueSeason<LeagueSeasonSettings>;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  pairPlayerId: string | undefined;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
}

export interface ResolveSeasonSimulationPreferencesResult {
  preferences: readonly ResolvedSeasonSimulationPreference[];
  warnings: readonly string[];
}

export interface SeasonSimulationPreferenceContext {
  input: ResolveSeasonSimulationPreferencesInput;
  positionRankMaximum: number;
  initialRosterByPlayerId: ReadonlyMap<string, LiveDraftRoomInitialRosterPlayer>;
  humanKeepers: readonly LiveDraftRoomInitialRosterPlayer[];
  openRosterSlots: number;
  humanPositionCounts: Readonly<Record<string, number>>;
  auctionBudgetRemaining: number | undefined;
  minimumBid: number | undefined;
}

export interface RankedPreferencePlayer {
  playerId: string;
  position: string;
  expectedValue: number;
  catalogIndex: number;
}
