import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockBoardReadModel,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export interface GenericAuctionMockAnalysisCache {
  eligibleAiTeamsByPlayerId: Map<string, readonly GenericAuctionMockTeamReadModel[]>;
  acquirableRbOrWrAlternativeByTeamId: Map<string, boolean>;
  remainingStarterEligiblePlayersByPosition: Map<string, readonly GenericAuctionMockBoardPlayer[]>;
  starterEligibilitySignalByPosition: Map<string, boolean>;
}

export interface GenericAuctionMockAnalysisCacheEntry {
  teams: readonly GenericAuctionMockTeamReadModel[];
  cache: GenericAuctionMockAnalysisCache;
}

const analysisCacheByBoard = new WeakMap<
  GenericAuctionMockBoardReadModel,
  GenericAuctionMockAnalysisCacheEntry
>();

export const analysisCacheFor = (state: GenericAuctionMockState): GenericAuctionMockAnalysisCache => {
  const cached = analysisCacheByBoard.get(state.board);
  if (cached?.teams === state.teams) return cached.cache;

  const created: GenericAuctionMockAnalysisCache = {
    eligibleAiTeamsByPlayerId: new Map(),
    acquirableRbOrWrAlternativeByTeamId: new Map(),
    remainingStarterEligiblePlayersByPosition: new Map(),
    starterEligibilitySignalByPosition: new Map(),
  };
  analysisCacheByBoard.set(state.board, { teams: state.teams, cache: created });
  return created;
};
