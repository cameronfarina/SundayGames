import { leagueConfig, ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { createPlatformAppContext } from "../src/platform/app/context.js";
import { InMemoryPlatformStore } from "../src/platform/app/store/InMemoryPlatformStore.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { PlatformLeagueMembership } from "../src/platform/leagueSetup.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

export const contextTestNow = new Date("2026-08-14T12:00:00.000Z");

export const contextTestRunner: SimulationMockBatchRunner = input => {
  const batch: MockBatch = {
    options: {
      scenarioKeys: ["expected"],
      runsPerScenario: input.runsPerScenario,
      seedPrefix: input.seedPrefix,
      forcedSales: [...input.forcedSales],
    },
    runs: [],
    summary: {
      runCount: input.runsPerScenario,
      scenarios: [],
      players: [],
      owners: [],
      ownerPlayerExposure: [],
    },
  };
  return batch;
};

export const contextTestAccount = (id: string): AccountRecord => ({
  id,
  email: `${id}@example.com`,
  createdAt: contextTestNow,
  updatedAt: contextTestNow,
});

export const createRegisteredContextFixture = () => {
  const store = new InMemoryPlatformStore();
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Context access league",
    setupStatus: "published",
  });
  const claimedTeam = season.teams[0];
  const otherTeam = season.teams[1];
  if (claimedTeam === undefined || otherTeam === undefined) {
    throw new Error("Context tests require at least two teams.");
  }
  const owner = contextTestAccount("context-owner");
  const member = contextTestAccount("context-member");
  const memberships: readonly PlatformLeagueMembership[] = [
    {
      userId: owner.id,
      leagueId: season.leagueId,
      role: "owner",
      teamId: claimedTeam.id,
      ownerId: claimedTeam.ownerId,
    },
    { userId: member.id, leagueId: season.leagueId, role: "member" },
  ];
  store.registerLeagueSeason({ season, memberships, createdByUserId: owner.id });
  const context = createPlatformAppContext({ store, simulationRunner: contextTestRunner });
  return { context, store, season, claimedTeam, otherTeam, owner, member };
};
