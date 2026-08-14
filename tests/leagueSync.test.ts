import { describe, expect, it } from "vitest";
import {
  leagueSyncProviderStatuses,
  leagueSyncReadOnlyPolicy,
  yahooAuthorizationEndpoint,
  yahooFantasyReadScope,
  yahooOAuthAuthorizeUrl,
  yahooTokenEndpoint,
} from "../src/modeling/leagueSync.js";

describe("league sync provider contract", () => {
  it("reports provider auth requirements while preserving read-only advice boundaries", () => {
    const providers = leagueSyncProviderStatuses({
      MOCKD_YAHOO_CLIENT_ID: "",
      MOCKD_YAHOO_CLIENT_SECRET: "",
      MOCKD_ESPN_LEAGUE_ID: "",
      MOCKD_ESPN_SWID: "",
      MOCKD_ESPN_S2: "",
    });

    expect(leagueSyncReadOnlyPolicy).toEqual({
      mode: "read-only",
      allowedActions: ["recommend", "sync"],
      blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
    });
    expect(providers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "sleeper",
        status: "available",
        auth: expect.objectContaining({ type: "none", configured: true }),
        readOnly: true,
      }),
      expect.objectContaining({
        key: "yahoo",
        status: "setup-required",
        auth: expect.objectContaining({ type: "oauth2", configured: false }),
        setupSteps: expect.arrayContaining([expect.stringMatching(/Yahoo Developer/i)]),
        readOnly: true,
      }),
      expect.objectContaining({
        key: "espn",
        status: "setup-required",
        auth: expect.objectContaining({ type: "manual-cookie", configured: false }),
        setupSteps: expect.arrayContaining([expect.stringMatching(/local/i)]),
        readOnly: true,
      }),
    ]));
  });

  it("reports credential providers as available only when every required value is present", () => {
    const providers = leagueSyncProviderStatuses({
      MOCKD_YAHOO_CLIENT_ID: " yahoo-id ",
      MOCKD_YAHOO_CLIENT_SECRET: "yahoo-secret",
      MOCKD_ESPN_LEAGUE_ID: "league-id",
      MOCKD_ESPN_SWID: "swid",
      MOCKD_ESPN_S2: "s2",
    });

    expect(providers.map(provider => provider.key)).toEqual([
      "mockd-draft",
      "sleeper",
      "yahoo",
      "espn",
    ]);
    expect(providers.find(provider => provider.key === "yahoo")).toMatchObject({
      status: "available",
      auth: {
        configured: true,
        requiredEnv: ["MOCKD_YAHOO_CLIENT_ID", "MOCKD_YAHOO_CLIENT_SECRET"],
      },
      connectUrl: "/api/sync/oauth/yahoo/start",
    });
    expect(providers.find(provider => provider.key === "espn")).toMatchObject({
      status: "available",
      auth: {
        configured: true,
        requiredEnv: ["MOCKD_ESPN_LEAGUE_ID", "MOCKD_ESPN_SWID", "MOCKD_ESPN_S2"],
      },
    });
  });

  it("treats whitespace-only credentials as missing", () => {
    const providers = leagueSyncProviderStatuses({
      MOCKD_YAHOO_CLIENT_ID: "yahoo-id",
      MOCKD_YAHOO_CLIENT_SECRET: "  ",
      MOCKD_ESPN_LEAGUE_ID: "league-id",
      MOCKD_ESPN_SWID: "\t",
      MOCKD_ESPN_S2: "s2",
    });

    expect(providers.find(provider => provider.key === "yahoo")?.status).toBe("setup-required");
    expect(providers.find(provider => provider.key === "espn")?.status).toBe("setup-required");
  });

  it("builds the Yahoo authorization URL with encoded defaults and optional scope", () => {
    const defaultUrl = new URL(yahooOAuthAuthorizeUrl({
      clientId: "client id",
      redirectUri: "https://mockd.test/oauth/callback?from=league",
      state: "state/value",
    }));
    const customUrl = new URL(yahooOAuthAuthorizeUrl({
      clientId: "client",
      redirectUri: "https://mockd.test/callback",
      state: "state",
      scope: "custom-read-scope",
    }));

    expect(yahooAuthorizationEndpoint).toBe("https://api.login.yahoo.com/oauth2/request_auth");
    expect(yahooTokenEndpoint).toBe("https://api.login.yahoo.com/oauth2/get_token");
    expect(defaultUrl.origin + defaultUrl.pathname).toBe(yahooAuthorizationEndpoint);
    expect(Object.fromEntries(defaultUrl.searchParams)).toEqual({
      client_id: "client id",
      redirect_uri: "https://mockd.test/oauth/callback?from=league",
      response_type: "code",
      scope: yahooFantasyReadScope,
      state: "state/value",
    });
    expect(customUrl.searchParams.get("scope")).toBe("custom-read-scope");
  });
});
