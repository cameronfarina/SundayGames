import { test } from "@playwright/test";
import { exerciseDeployedWorkspace } from "../support/platform-readiness/deployedWorkspace.js";
import { isDeployedSmoke } from "../support/platform-readiness/environment.js";

test("deployed platform supports authenticated workspaces without mutating the real draft", async ({ browser }) => {
  test.skip(!isDeployedSmoke, "Deployed smoke credentials are not used by local E2E.");
  await exerciseDeployedWorkspace(browser);
});
