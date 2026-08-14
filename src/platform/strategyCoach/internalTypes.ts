import type {
  StrategyCoachPlayerCatalogEntry,
  StrategyCoachPriceSource,
} from "./contracts.js";

export interface CatalogCandidate {
  entry: StrategyCoachPlayerCatalogEntry;
  normalizedName: string;
  aliases: readonly string[];
}

export interface ResolvedPlayer {
  entry: StrategyCoachPlayerCatalogEntry;
  normalizedName: string;
}

export interface PlayerMention {
  entry: StrategyCoachPlayerCatalogEntry;
  normalizedName: string;
  rawMention: string;
  index: number;
}

export interface PriceValue {
  value: number;
  source: StrategyCoachPriceSource;
}

export type PricePreference = "draft" | "target";
