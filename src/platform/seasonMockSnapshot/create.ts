import {
  normalizeLeagueSeasonSettings,
  type ExplicitLeagueSeasonSettings,
  type LeagueSeason,
} from "../leagueSeason.js";
import type {
  CreateSeasonMockConfigurationSnapshotInput,
  SeasonMockConfigurationSnapshotV2,
} from "./contracts.js";
import {
  seasonMockSnapshotSchema,
  seasonMockSnapshotVersion,
} from "./constants.js";
import { malformedSnapshot } from "./errors.js";
import { normalizeSeasonMockConfigurationSnapshot } from "./normalize.js";

export const createSeasonMockConfigurationSnapshot = ({
  season,
  setup,
  humanTeamId,
  playerExpectedPrices,
  playerHumanValues = playerExpectedPrices,
  managerProfiles = [],
  capturedAt = new Date(),
}: CreateSeasonMockConfigurationSnapshotInput): SeasonMockConfigurationSnapshotV2 => {
  const normalizedSeason: LeagueSeason<ExplicitLeagueSeasonSettings> = {
    ...structuredClone(season),
    settings: normalizeLeagueSeasonSettings(season.settings),
  };
  const snapshot = normalizeSeasonMockConfigurationSnapshot({
    status: "ready",
    schema: seasonMockSnapshotSchema,
    version: seasonMockSnapshotVersion,
    capturedAt: capturedAt.toISOString(),
    payload: {
      season: normalizedSeason,
      setup: {
        ...structuredClone(setup),
        updatedAt: setup.updatedAt.toISOString(),
      },
      humanTeamId,
      playerExpectedPrices: { ...playerExpectedPrices },
      playerHumanValues: { ...playerHumanValues },
      managerProfiles: structuredClone(managerProfiles),
    },
  });
  return snapshot.status === "ready" ? snapshot : malformedSnapshot();
};
