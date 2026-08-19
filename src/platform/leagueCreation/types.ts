import type { Position } from "../../../config/league.js";
import type {
  LeagueProvider,
  RosterMaximums,
  ScoringSettings,
} from "../leagueSeason.js";

export interface ConfirmedLeagueTeamInput {
  externalTeamId: string;
  displayName: string;
  abbreviation?: string | null;
  managerNames?: readonly string[];
}

export type ConfirmedLeagueDraftInput =
  | {
      type: "auction";
      budgetDollars: number;
      minimumBidDollars: number;
    }
  | {
      type: "snake";
      rounds: number;
      order: readonly string[];
    };

export interface ConfirmedLeagueCreationInput {
  provider: LeagueProvider;
  externalLeagueId: string;
  leagueName: string;
  seasonYear: number;
  expectedTeamCount: number;
  keeperLeague?: boolean;
  teams: readonly ConfirmedLeagueTeamInput[];
  draft: ConfirmedLeagueDraftInput;
  scoring: ScoringSettings;
  rosterSlots: Readonly<Record<string, number>>;
}

export interface DraftableRosterSlotAnalysis {
  slot: string;
  count: number;
  eligiblePositions: readonly Position[];
}

export interface RosterSlotAnalysis {
  draftableSlots: readonly DraftableRosterSlotAnalysis[];
  draftCapacity: number;
  rosterMaximums: RosterMaximums;
  unsupportedSlots: readonly string[];
}
