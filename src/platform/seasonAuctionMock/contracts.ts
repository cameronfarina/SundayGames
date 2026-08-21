import type { HistoricalSaleRecord } from "../historicalImports/saleContracts.js";
import type { ExplicitLeagueSeason } from "../leagueSeason/contracts.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups/contracts.js";
import type { ManagerDraftProfileSnapshot } from "../managerDraftProfiles.js";

export interface BuildSeasonAuctionMockConfigInput {
  season: ExplicitLeagueSeason;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  sessionId: string;
  seed: string;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
  playerHumanValues?: Readonly<Record<string, number>> | undefined;
  historicalSaleRecords?: readonly HistoricalSaleRecord[] | undefined;
  managerProfiles?: readonly ManagerDraftProfileSnapshot[] | undefined;
}
