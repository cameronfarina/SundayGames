import { normalizeLeagueSeasonSettings } from "../leagueSeason.js";
import { normalizePersistedMockDraftSession } from "../mockSessions.js";
import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";
import type { SerializedPlatformStoreSnapshot } from "./contracts.js";

export const serializePlatformStoreSnapshot = (
  snapshot: InMemoryPlatformStoreSnapshot,
): SerializedPlatformStoreSnapshot => ({
  schemaVersion: 1,
  ...snapshot,
  leagueSeasons: snapshot.leagueSeasons.map(season => ({
    ...season,
    settings: normalizeLeagueSeasonSettings(season.settings),
  })),
  mockDraftSessions: snapshot.mockDraftSessions.map(normalizePersistedMockDraftSession),
});
