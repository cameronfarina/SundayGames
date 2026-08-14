import type { Position } from "../../../config/league.js";

export type MyExpertAdviceType = "add-drop" | "bye-coverage" | "injury-watch" | "lineup" | "trade-target";
export type MyExpertPriority = "high" | "medium" | "low";
export type MyExpertRosterRole = "starter" | "bench" | "injured-reserve";
export type MyExpertLineupSlot = Position | "FLEX";

export interface MyExpertLeagueSettings {
  lineup: Partial<Record<Position | "FLEX", number>>;
  rosterMaximums: Partial<Record<Position, number>>;
}

export interface MyExpertPlayerSignals {
  opportunityScore?: number | undefined;
  matchupScore?: number | undefined;
  usageScore?: number | undefined;
  injuryRisk?: number | undefined;
  trendScore?: number | undefined;
  weatherRisk?: number | undefined;
}

export interface MyExpertPlayer {
  id: string;
  name: string;
  position: Position;
  teamAbbreviation?: string | undefined;
  projectedPoints: number;
  rosteredRole?: MyExpertRosterRole | undefined;
  byeWeek?: number | undefined;
  rosteredPercent?: number | undefined;
  signals?: MyExpertPlayerSignals | undefined;
}

export interface MyExpertMatchupSignal {
  playerId: string;
  week: number;
  opponent?: string | undefined;
  score: number;
  label?: string | undefined;
}

export interface MyExpertNewsSignal {
  playerId: string;
  headline: string;
  impact: "positive" | "watch" | "negative";
  severity?: number | undefined;
  sourceDate?: string | undefined;
}

export interface MyExpertTradeCandidate {
  id: string;
  name: string;
  position: Position;
  teamAbbreviation?: string | undefined;
  projectedPoints: number;
  managerNeed?: string | undefined;
  acquisitionCost?: "low" | "fair" | "high" | undefined;
  signals?: MyExpertPlayerSignals | undefined;
}

export interface BuildMyExpertAdviceOptions {
  currentWeek: number;
  leagueSettings: MyExpertLeagueSettings;
  roster: readonly MyExpertPlayer[];
  availablePlayers: readonly MyExpertPlayer[];
  matchups: readonly MyExpertMatchupSignal[];
  news: readonly MyExpertNewsSignal[];
  tradeCandidates: readonly MyExpertTradeCandidate[];
}

export interface MyExpertAdviceAction {
  kind: "recommendation";
  readOnly: true;
  label: string;
}

export interface MyExpertLineupSelection {
  slot: MyExpertLineupSlot;
  playerId: string;
  name: string;
  position: Position;
  projectedPoints: number;
  adjustedScore: number;
  reason: string;
  evidence: string[];
  risk: string;
}

export interface MyExpertLineupRecommendation {
  starters: MyExpertLineupSelection[];
  flexChoice: MyExpertLineupSelection;
  flexCandidates: MyExpertLineupSelection[];
}

export interface MyExpertAdviceCard {
  id: string;
  type: MyExpertAdviceType;
  title: string;
  priority: MyExpertPriority;
  playerIds: string[];
  action: MyExpertAdviceAction;
  summary: string;
  reasons: string[];
  lineup?: MyExpertLineupRecommendation | undefined;
}

export interface MyExpertReadOnlyPolicy {
  mode: "read-only";
  allowedActions: readonly ["recommend"];
  blockedActions: readonly ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"];
}

export interface MyExpertAdvice {
  currentWeek: number;
  policy: MyExpertReadOnlyPolicy;
  cards: MyExpertAdviceCard[];
}
