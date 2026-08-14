import type { GenericAuctionMockConfig } from "./config.js";
import type {
  GenericAuctionMockBoardReadModel,
  GenericAuctionMockEvent,
  GenericAuctionMockSale,
  GenericAuctionMockSessionReadModel,
  GenericAuctionMockTeamReadModel,
} from "./readModels.js";

export interface GenericAuctionMockSnapshot {
  session: Pick<
    GenericAuctionMockSessionReadModel,
    | "status"
    | "phase"
    | "nextNominatorTeamId"
    | "currentNomination"
    | "nominationsCompleted"
    | "canComplete"
  > & { nextNominatorIndex: number };
  board: GenericAuctionMockBoardReadModel;
  teams: readonly GenericAuctionMockTeamReadModel[];
  sales: readonly GenericAuctionMockSale[];
  auctionEvents: readonly GenericAuctionMockEvent[];
}

export interface GenericAuctionMockState {
  readonly configuration: GenericAuctionMockConfig;
  session: GenericAuctionMockSessionReadModel;
  board: GenericAuctionMockBoardReadModel;
  teams: readonly GenericAuctionMockTeamReadModel[];
  sales: readonly GenericAuctionMockSale[];
  auctionEvents: readonly GenericAuctionMockEvent[];
  readonly decisionHistory: readonly GenericAuctionMockSnapshot[];
  readonly nextNominatorIndex: number;
}
