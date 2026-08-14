import type {
  AuctionEngineConfig,
  AuctionOwnerState,
} from "../auctionEngine.js";
import type { KeeperScenario } from "../keeperInflation.js";
import type { LiveDraftState } from "../liveDraft.js";
import type { Player } from "../../types.js";

export interface PreparedInteractiveMockDraft {
  scenario: KeeperScenario;
  liveState: LiveDraftState;
  auctionPlayers: Player[];
  ownerStates: AuctionOwnerState[];
  config: AuctionEngineConfig;
}
