import type { ExplicitLeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups.js";

export interface BuildSeasonAuctionMockConfigInput {
  season: ExplicitLeagueSeason;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  sessionId: string;
  seed: string;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
  playerHumanValues?: Readonly<Record<string, number>> | undefined;
}
