import type { Owner, Position } from "../../../config/league.js";

export type StrategyCoachMessageRole = "system" | "user" | "assistant";
export type StrategyCoachGuardrailSeverity = "info" | "warn" | "block";
export type StrategyCoachGuardrailCode =
  | "ambiguous_player"
  | "global_cap_conflict"
  | "missing_player"
  | "missing_price"
  | "price_capped"
  | "unresolved_wr_targets";
export type StrategyCoachConstraintIntent = "draft" | "target";
export type StrategyCoachPriceSource =
  | "expectedPrice"
  | "fallbackPrice"
  | "marketPrice"
  | "maxBid"
  | "price"
  | "prompt"
  | "recommendedMaxBid";

export interface StrategyCoachOwnerIdentity {
  ownerId: string;
  ownerName: Owner | string;
  teamId?: string;
  teamName?: string;
}

export interface StrategyCoachMessage {
  id: string;
  conversationId: string;
  role: StrategyCoachMessageRole;
  content: string;
  createdAt: Date;
  planId?: string;
}

export interface StrategyCoachConversation {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  privateOwnerUserId: string;
  owner: StrategyCoachOwnerIdentity;
  promptText: string;
  messages: readonly StrategyCoachMessage[];
  planIds: readonly string[];
  createdAt: Date;
}

export interface StrategyCoachPlayerCatalogEntry {
  playerId?: string;
  name: string;
  normalizedName?: string;
  position: Position;
  price?: number;
  expectedPrice?: number;
  marketPrice?: number;
  recommendedMaxBid?: number;
  maxBid?: number;
  fallbackPrice?: number;
  aliases?: readonly string[];
}

export interface StrategyCoachPlayerConstraint {
  intent: StrategyCoachConstraintIntent;
  rawMention: string;
  playerName: string;
  normalizedName: string;
  position: Position;
  playerId?: string;
  slot?: string;
  price?: number;
  maxBid?: number;
  priceSource?: StrategyCoachPriceSource;
}

export interface StrategyCoachGuardrail {
  code: StrategyCoachGuardrailCode;
  severity: StrategyCoachGuardrailSeverity;
  message: string;
  rawMention?: string;
  playerName?: string;
  candidates?: readonly string[];
}

export interface StrategyCoachExtractedConstraints {
  hardLocks: readonly StrategyCoachPlayerConstraint[];
  rb2Alternatives: readonly StrategyCoachPlayerConstraint[];
  wrCandidates: readonly StrategyCoachPlayerConstraint[];
  desiredWrCount?: number;
  globalMaxPrice?: number;
  globalMaxExcludesKeeper: boolean;
  avoidElite: boolean;
  valueIntent: boolean;
}

export interface StrategyCoachVariant {
  id: string;
  name: string;
  summary: string;
  runnable: boolean;
  commands: readonly string[];
  hardLocks: readonly StrategyCoachPlayerConstraint[];
  rb2Selection?: StrategyCoachPlayerConstraint;
  wrTargets: readonly StrategyCoachPlayerConstraint[];
  guardrails: readonly StrategyCoachGuardrail[];
}

export interface StrategyCoachPlan {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  privateOwnerUserId: string;
  owner: StrategyCoachOwnerIdentity;
  promptText: string;
  extractedConstraints: StrategyCoachExtractedConstraints;
  variants: readonly StrategyCoachVariant[];
  guardrails: readonly StrategyCoachGuardrail[];
  createdAt: Date;
  conversationId?: string;
}

export interface BuildStrategyCoachPlanInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  privateOwnerUserId: string;
  owner: StrategyCoachOwnerIdentity;
  promptText: string;
  playerCatalog: readonly StrategyCoachPlayerCatalogEntry[];
  createdAt?: Date;
  conversationId?: string;
}

export interface StrategyCoachService {
  createPlanFromPrompt(input: BuildStrategyCoachPlanInput): {
    conversation: StrategyCoachConversation;
    plan: StrategyCoachPlan;
  };
  getConversationForUser(userId: string, conversationId: string): StrategyCoachConversation | null;
  getPlanForUser(userId: string, planId: string): StrategyCoachPlan | null;
  listConversationsForUser(userId: string, leagueId?: string, seasonId?: string): readonly StrategyCoachConversation[];
  listPlansForUser(userId: string, leagueId?: string, seasonId?: string): readonly StrategyCoachPlan[];
}
