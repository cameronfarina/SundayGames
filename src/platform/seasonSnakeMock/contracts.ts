import type { ExplicitLeagueSeason } from "../leagueSeason/contracts.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups/contracts.js";

export interface BuildSeasonSnakeMockConfigInput {
  season: ExplicitLeagueSeason;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  sessionId: string;
  seed: string;
}
