import { leagueConfig, ownerOrder } from "../../../config/league.js";
import type { MockBatch } from "../../../src/modeling/mockBatch.js";
import {
  buildCurrentMockdLeagueSeason,
  type LeagueSeason,
} from "../../../src/platform/leagueSeason.js";
import type { LeagueCreationLimits } from "../../../src/platform/leagueSetup.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../../src/platform/liveDraftRooms.js";
import type { PricingSourcePrice } from "../../../src/platform/pricingSnapshots.js";
import {
  createPlatformApp,
} from "../../../src/platform/platformApp.js";
import type { SimulationMockBatchRunner } from "../../../src/platform/simulations.js";

export const now = new Date("2026-08-09T12:00:00.000Z");

export const playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
];

export const baselinePrices: readonly PricingSourcePrice[] = [
  { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
  { name: "Bijan Robinson", normalizedName: "bijan robinson", position: "RB", price: 50 },
];

export const mockRunner: SimulationMockBatchRunner = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

export const signUpAndLogin = async (
  app: ReturnType<typeof createPlatformApp>,
  email: string,
  password: string,
  createdAt: Date,
) => {
  await app.createAccount({ email, password, now: createdAt });
  const login = await app.login({ email, password, now: createdAt });
  if (login === null) throw new Error(`Expected ${email} login.`);

  return login;
};

export const asSnakeSeason = (season: LeagueSeason): LeagueSeason => ({
  ...season,
  settings: {
    expectedTeamCount: season.settings.expectedTeamCount,
    draftFormat: "snake",
    ...(season.settings.scoring === undefined ? {} : { scoring: season.settings.scoring }),
    snake: {
      rounds: season.settings.roster.rosterSize,
      order: season.teams.map(team => team.id),
    },
    roster: season.settings.roster,
    keeperPolicy: season.settings.keeperPolicy,
  },
});

export const seasonForLeague = (key: string): LeagueSeason => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: `League ${key}`,
    setupStatus: "draft",
  });
  const leagueId = `league-${key}`;
  const seasonId = `season-${key}`;

  return {
    ...season,
    id: seasonId,
    leagueId,
    league: { ...season.league, id: leagueId, externalLeagueId: key },
    teams: season.teams.map(team => ({
      ...team,
      id: `${team.id}-${key}`,
      leagueSeasonId: seasonId,
    })),
  };
};

export const strictLeagueCreationLimits: LeagueCreationLimits = {
  maxActiveLeaguesPerAccount: 1,
  maxCreatedLeaguesPerWindow: 1,
  creationWindowMs: 60 * 60 * 1_000,
};
