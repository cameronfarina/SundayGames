import { describe, expect, it } from "vitest";
import {
  InMemoryAccountOnboardingRepository,
  accountOnboardingSnapshot,
} from "../src/platform/accountOnboarding.js";
import { InMemoryPlatformStore } from "../src/platform/platformApp.js";
import { deserializePlatformStoreSnapshot } from "../src/platform/platformStoreSnapshotCodec.js";

const now = new Date("2026-08-21T14:00:00.000Z");

describe("account onboarding", () => {
  it("resumes each durable setup stage and keeps completion monotonic", async () => {
    const repository = new InMemoryAccountOnboardingRepository();

    await expect(accountOnboardingSnapshot(repository, "account-1")).resolves.toEqual({
      intent: null,
      providers: null,
      stage: "intent",
    });

    await repository.setIntent({ accountId: "account-1", intent: "practice", now });
    await expect(accountOnboardingSnapshot(repository, "account-1")).resolves.toEqual({
      intent: "practice",
      providers: null,
      stage: "providers",
    });

    await repository.setProviders({
      accountId: "account-1",
      providers: ["sleeper", "espn"],
      now,
    });
    await expect(accountOnboardingSnapshot(repository, "account-1")).resolves.toEqual({
      intent: "practice",
      providers: ["sleeper", "espn"],
      stage: "connections",
    });

    await repository.complete({ accountId: "account-1", now });
    await expect(accountOnboardingSnapshot(repository, "account-1")).resolves.toEqual({
      intent: "practice",
      providers: ["sleeper", "espn"],
      stage: "complete",
    });

    await repository.setIntent({ accountId: "account-1", intent: "live_draft", now });
    await expect(accountOnboardingSnapshot(repository, "account-1")).resolves.toMatchObject({
      intent: "practice",
      stage: "complete",
    });
  });

  it("persists partial answers in the platform store snapshot", async () => {
    const store = new InMemoryPlatformStore();
    await store.accountOnboarding.setIntent({
      accountId: "account-1",
      intent: "live_draft",
      now,
    });

    const restored = new InMemoryPlatformStore(store.snapshot());

    await expect(accountOnboardingSnapshot(restored.accountOnboarding, "account-1"))
      .resolves.toMatchObject({
      intent: "live_draft",
      stage: "providers",
    });
  });

  it("preserves a future combined marker across an unrelated file-store write", async () => {
    const emptySnapshot = new InMemoryPlatformStore().snapshot();
    const store = new InMemoryPlatformStore(deserializePlatformStoreSnapshot({
      ...emptySnapshot,
      accountOnboardingProfiles: [{
        accountId: "account-1",
        intent: "live_draft",
        intentBoth: true,
        providers: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      }],
    }));

    await store.accountOnboarding.setProviders({
      accountId: "account-1",
      providers: ["sleeper"],
      now,
    });

    expect(store.snapshot().accountOnboardingProfiles?.[0]).toMatchObject({
      intent: "live_draft",
      intentBoth: true,
      providers: ["sleeper"],
    });
  });

  it("persists the combined intent in the platform store snapshot", async () => {
    const store = new InMemoryPlatformStore();
    await store.accountOnboarding.setIntent({ accountId: "account-1", intent: "both", now });
    const snapshot = store.snapshot();

    expect(snapshot.accountOnboardingProfiles?.[0]).toMatchObject({
      intent: "live_draft",
      intentBoth: true,
    });

    const restored = new InMemoryPlatformStore(
      deserializePlatformStoreSnapshot(snapshot),
    );

    await expect(accountOnboardingSnapshot(restored.accountOnboarding, "account-1"))
      .resolves.toMatchObject({ intent: "both", stage: "providers" });
  });

  it("exempts accounts restored from a legacy embedded-auth snapshot", async () => {
    const restored = new InMemoryPlatformStore(deserializePlatformStoreSnapshot({
      auth: {
        accountCredentials: [{
          account: {
            id: "account-legacy",
            email: "legacy@example.com",
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          passwordHash: "legacy-password-hash",
        }],
        sessions: [],
      },
    }));

    await expect(accountOnboardingSnapshot(restored.accountOnboarding, "account-legacy"))
      .resolves.toEqual({ intent: null, providers: null, stage: "complete" });
  });

  it("keeps an explicit current empty profile collection pending", async () => {
    const restored = new InMemoryPlatformStore({
      auth: {
        accountCredentials: [{
          account: {
            id: "account-new",
            email: "new@example.com",
            createdAt: now,
            updatedAt: now,
          },
          passwordHash: "password-hash",
        }],
        sessions: [],
      },
      accountOnboardingProfiles: [],
      leagueSeasons: [],
      memberships: [],
      mockDraftSessions: [],
      simulationRuns: [],
      practiceShortlistItems: [],
      liveDraftRooms: [],
      liveDraftRoomSetups: [],
      historicalImportBatches: [],
      historicalSaleRecords: [],
      pricingSnapshots: [],
      jobs: [],
      exportArtifacts: [],
      exportArtifactContents: [],
    });

    await expect(accountOnboardingSnapshot(restored.accountOnboarding, "account-new"))
      .resolves.toEqual({ intent: null, providers: null, stage: "intent" });
  });
});
