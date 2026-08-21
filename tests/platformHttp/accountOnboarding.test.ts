import { describe, expect, it } from "vitest";
import { InMemoryAccountOnboardingRepository } from "../../src/platform/accountOnboarding.js";
import { InMemoryPlatformStore, createPlatformApp } from "../../src/platform/platformApp.js";
import { createPlatformHttpHandler } from "../../src/platform/platformHttp.js";
import { createLoggedInAccount, mockRunner, now } from "./support/index.js";

const createHarness = () => {
  const repository = new InMemoryAccountOnboardingRepository();
  const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
  return {
    handle: createPlatformHttpHandler(app, { accountOnboardingRepository: repository }),
    repository,
  };
};

describe("account onboarding HTTP", () => {
  it("requires authentication and rejects a stale tab's account identity", async () => {
    const { handle, repository } = createHarness();
    const account = await createLoggedInAccount(handle, "setup@example.com");

    const signedOut = await handle({
      method: "PUT",
      path: "/account-onboarding",
      body: { accountId: account.account.id, action: "set_intent", intent: "practice" },
      now,
    });
    const mismatched = await handle({
      method: "PUT",
      path: "/account-onboarding",
      sessionToken: account.sessionToken,
      body: { accountId: "another-account", action: "set_intent", intent: "practice" },
      now,
    });

    expect(signedOut).toMatchObject({ status: 401 });
    expect(mismatched).toEqual({
      status: 409,
      body: {
        error: {
          code: "account_changed",
          message: "Your signed-in account changed. Refresh and try again.",
        },
      },
    });
    expect(repository.findByAccountId("another-account")).toBeNull();
  });

  it("saves both questions, validates the exclusive no-league answer, and completes", async () => {
    const { handle, repository } = createHarness();
    const account = await createLoggedInAccount(handle, "setup@example.com");
    const request = (body: object) => handle({
      method: "PUT",
      path: "/account-onboarding",
      sessionToken: account.sessionToken,
      body: { accountId: account.account.id, ...body },
      now,
    });

    await expect(request({
      action: "set_intent",
      intent: "live_draft",
      intentBoth: true,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        onboarding: {
          intent: "live_draft",
          intentBoth: true,
          stage: "providers",
        },
      },
    });
    expect(repository.findByAccountId(account.account.id))
      .toMatchObject({ intent: "both" });
    await expect(request({
      action: "set_providers",
      providers: ["espn", "none"],
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_onboarding_providers" } },
    });
    await expect(request({
      action: "set_intent",
      intent: "practice",
      intentBoth: true,
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_onboarding_intent" } },
    });
    await expect(request({
      action: "set_intent",
      intent: "live_draft",
      intentBoth: "yes",
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_onboarding_intent" } },
    });
    await expect(request({
      action: "set_providers",
      providers: ["espn", "sleeper", "espn"],
    })).resolves.toMatchObject({
      status: 200,
      body: {
        onboarding: {
          providers: ["espn", "sleeper"],
          stage: "connections",
        },
      },
    });
    await expect(request({ action: "complete" })).resolves.toMatchObject({
      status: 200,
      body: { onboarding: { stage: "complete" } },
    });
  });

  it("returns the current setup snapshot with login and session bootstrap", async () => {
    const { handle, repository } = createHarness();
    const account = await createLoggedInAccount(handle, "resume@example.com");
    await repository.setIntent({ accountId: account.account.id, intent: "both", now });

    const current = await handle({
      method: "GET",
      path: "/session",
      sessionToken: account.sessionToken,
      now,
    });

    expect(current).toMatchObject({
      status: 200,
      body: {
        account: { id: account.account.id },
        onboarding: {
          intent: "live_draft",
          intentBoth: true,
          providers: null,
          stage: "providers",
        },
      },
    });
  });
});
