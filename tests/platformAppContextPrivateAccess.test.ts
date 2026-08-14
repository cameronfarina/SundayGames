import { describe, expect, it } from "vitest";
import { createPlatformAppContext } from "../src/platform/app/context.js";
import { InMemoryPlatformStore } from "../src/platform/app/store/InMemoryPlatformStore.js";
import type { MockDraftResultReference } from "../src/platform/mockSessions.js";
import {
  contextTestAccount,
  contextTestNow,
  contextTestRunner,
  createRegisteredContextFixture,
} from "./platformAppContextFixtures.js";

class FailingSeasonStore extends InMemoryPlatformStore {
  override findLeagueSeason(): never {
    throw new Error("League storage failed.");
  }
}

describe("platform app context private access", () => {
  it("distinguishes claim, team, and league mismatches", async () => {
    const { context, store, season, claimedTeam, otherTeam, owner, member } =
      createRegisteredContextFixture();
    const correctInput = {
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: claimedTeam.ownerId,
      teamId: claimedTeam.id,
    };

    await expect(context.requirePrivateTeamContext(owner, correctInput)).resolves.toEqual(season);
    await expect(context.canReadPrivateTeamContext(owner, correctInput)).resolves.toBe(true);
    await expect(context.canReadPrivateTeamContext(member, correctInput)).resolves.toBe(false);
    await expect(context.canReadPrivateTeamContext(owner, {
      ...correctInput,
      teamId: "missing-team",
    })).resolves.toBe(false);
    await expect(context.canReadPrivateTeamContext(owner, {
      ...correctInput,
      teamId: otherTeam.id,
      ownerId: otherTeam.ownerId,
    })).resolves.toBe(false);
    const otherLeagueId = "context-other-league";
    store.replaceMembershipsForLeague(otherLeagueId, [{
      userId: owner.id,
      leagueId: otherLeagueId,
      role: "owner",
      teamId: claimedTeam.id,
      ownerId: claimedTeam.ownerId,
    }]);
    await expect(context.canReadPrivateTeamContext(owner, {
      ...correctInput,
      leagueId: otherLeagueId,
    })).resolves.toBe(false);
  });

  it("validates simulation result ownership and propagates unexpected storage failures", async () => {
    const { context, season, claimedTeam, owner } = createRegisteredContextFixture();
    const mockReference: MockDraftResultReference = { id: "mock-result-1", kind: "mock-result" };
    await expect(
      context.requireReadableMockDraftResultReference(owner, mockReference),
    ).resolves.toEqual(mockReference);
    await expect(context.requireReadableMockDraftResultReference(owner, {
      id: "missing-simulation",
      kind: "simulation-result",
    })).rejects.toMatchObject({ code: "private_resource" });
    const run = await context.simulations.createRequest({
      userId: owner.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: claimedTeam.ownerId,
      teamId: claimedTeam.id,
      count: 1,
      seedPrefix: "context-access",
      idempotencyKey: "context-access",
      strategy: { hardLocks: [], softTargets: [] },
      createdAt: contextTestNow,
    });
    const simulationReference: MockDraftResultReference = {
      id: run.id,
      kind: "simulation-result",
    };
    await expect(
      context.requireReadableMockDraftResultReference(owner, simulationReference),
    ).resolves.toEqual(simulationReference);

    const failingContext = createPlatformAppContext({
      store: new InMemoryPlatformStore(),
      leagueSetupRepository: new FailingSeasonStore(),
      simulationRunner: contextTestRunner,
    });
    await expect(failingContext.canReadPrivateTeamContext(contextTestAccount("failed-reader"), {
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: claimedTeam.ownerId,
      teamId: claimedTeam.id,
    })).rejects.toThrow("League storage failed.");
  });
});
