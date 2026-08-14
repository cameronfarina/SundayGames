import {
  currentLeagueInitialRostersFor,
  loadLocalDemoPlayerCatalog,
} from "../localDemoFixtures.js";
import type { LeagueSeason } from "../leagueSeason.js";
import {
  liveDraftRoomSetupContentHash,
  type LiveDraftRoomSetup,
} from "../liveDraftRoomSetups.js";

export const localFixtureDraftSetupFor = async (
  season: LeagueSeason,
): Promise<LiveDraftRoomSetup> => {
  const input = {
    seasonId: season.id,
    sourceVersion: "local-fixtures-2026",
    playerCatalog: await loadLocalDemoPlayerCatalog(),
    initialRosters: currentLeagueInitialRostersFor(season),
  };

  return {
    ...input,
    contentHash: liveDraftRoomSetupContentHash(input),
    updatedAt: new Date(),
  };
};
