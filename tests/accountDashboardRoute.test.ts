import { describe, expect, it } from "vitest";
import type { AccountDashboardRepository } from "../src/platform/accountDashboard.js";
import { routeAccountDashboard } from "../src/platform/http/routes/accountDashboard.js";
import { parsedRequestFor } from "../src/platform/http/request/parsedRequest.js";
import { createPlatformApp } from "../src/platform/platformApp.js";
import { createPlatformHttpHandler } from "../src/platform/platformHttp.js";
import { createLoggedInAccount, mockRunner } from "./platformHttp/support/index.js";

describe("account dashboard route", () => {
  it("loads only the authenticated account dashboard", async () => {
    const app = createPlatformApp({ simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, { allowPublicSignup: true });
    const login = await createLoggedInAccount(handle, "dashboard@example.com");
    const requestedAccountIds: string[] = [];
    const repository: AccountDashboardRepository = {
      listForAccount: accountId => {
        requestedAccountIds.push(accountId);
        return Promise.resolve([]);
      },
    };

    const response = await routeAccountDashboard(app, parsedRequestFor({
      method: "GET",
      path: "/account-dashboard",
      sessionToken: login.sessionToken,
    }), repository);

    expect(response).toEqual({ status: 200, body: { leagues: [] } });
    expect(requestedAccountIds).toEqual([login.account.id]);
  });
});
