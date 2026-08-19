import type { PlayerContextEvidence } from "../../../config/playerContext.js";
import type { RawPlayerNewsItem } from "../../data/playerNewsProviderAdapters.js";
import type {
  PlayerNewsCategory,
  PlayerNewsDraftAction,
  PlayerNewsSourceMode,
} from "./categoryContracts.js";
import type {
  PlayerNewsAuctionSnapshot,
  PlayerNewsAvailability,
  PlayerNewsDraftState,
  PlayerNewsPlayerMetadata,
} from "./draftContracts.js";

export interface PlayerNewsSource {
  provider: string;
  url?: string;
  quality?: string;
}

export interface PlayerNewsItem {
  id: string;
  providerItemId: string;
  player: string;
  normalizedPlayerName: string;
  position?: string;
  teamAbbreviation?: string;
  category: PlayerNewsCategory;
  /** Every label the provider itself applied. RotoWire supplies none. */
  categories?: string[];
  headline: string;
  fantasyImpact: string;
  /** The analyst take FantasyPros ships alongside the report itself. */
  analystImpact?: string;
  sourceDate?: string;
  fetchedAt?: string;
  source: PlayerNewsSource;
  draftAction: PlayerNewsDraftAction;
  impactScore: number;
  auction: PlayerNewsAuctionSnapshot;
  availability: PlayerNewsAvailability;
}

export interface PlayerNewsProviderStatus {
  key: string;
  label: string;
  status: "active" | "available" | "candidate";
  detail: string;
}

export interface PlayerNewsFilters {
  source?: PlayerNewsSourceMode;
  query?: string;
  category?: string;
  draftAction?: string;
}

export interface PlayerNewsSummary {
  totalCount: number;
  filteredCount: number;
  moveUpCount: number;
  watchCount: number;
  fadeCount: number;
  noChangeCount: number;
}

export interface PlayerNewsFeed {
  sourceMode: PlayerNewsSourceMode;
  generatedAt: string;
  summary: PlayerNewsSummary;
  providers: PlayerNewsProviderStatus[];
  items: PlayerNewsItem[];
}

export interface BuildPlayerNewsFeedOptions {
  evidenceRows?: readonly PlayerContextEvidence[];
  rawNewsItems?: readonly RawPlayerNewsItem[];
  playerMetadata?: readonly PlayerNewsPlayerMetadata[];
  draftState: PlayerNewsDraftState;
  filters?: PlayerNewsFilters;
  generatedAt?: string;
  localEvidencePath?: string;
}
