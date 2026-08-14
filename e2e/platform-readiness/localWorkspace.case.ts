import { test } from "@playwright/test";
import { isDeployedSmoke } from "../support/platform-readiness/environment.js";
import { localFixtureWorkspace } from "../support/platform-readiness/localFixture.js";
import { exerciseReadyWorkspace } from "../support/platform-readiness/readyWorkspace.js";

test("local platform supports fixture signup, setup, invitation, realtime draft, and final-export gating", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  await exerciseReadyWorkspace(await localFixtureWorkspace(browser));
});
