import { describe, expect, it } from "vitest";
import {
  resolvePlatformE2eRunConfig,
  verifyDeployedPlatformSessionRoute,
} from "../scripts/run-platform-e2e.js";

describe("platform E2E runner", () => {
  it("keeps the default run local and passes Playwright args through", () => {
    const config = resolvePlatformE2eRunConfig({}, ["--headed", "--project=chromium"]);

    expect(config).toMatchObject({
      target: "local",
      baseUrl: undefined,
      smokeRunId: undefined,
      playwrightArgs: ["--headed", "--project=chromium"],
    });
  });

  it("builds deployed smoke config from args without treating runner flags as Playwright flags", () => {
    const config = resolvePlatformE2eRunConfig(
      {
        MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL: " commissioner@mockd.test ",
        MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD: " commissioner password ",
        MOCKD_E2E_DEPLOYED_MEMBER_EMAIL: " member@mockd.test ",
        MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD: " member password ",
        MOCKD_E2E_DEPLOYED_SEASON_ID: " smoke-season-2026 ",
      },
      ["--base-url=https://staging.mockd.test", "--project=chromium"],
    );

    expect(config).toMatchObject({
      target: "deployed",
      baseUrl: "https://staging.mockd.test",
      smokeRunId: undefined,
      deployedSmoke: {
        commissionerEmail: "commissioner@mockd.test",
        commissionerPassword: "commissioner password",
        memberEmail: "member@mockd.test",
        memberPassword: "member password",
        seasonId: "smoke-season-2026",
      },
      playwrightArgs: ["--project=chromium"],
    });
  });

  it("requires pre-provisioned smoke credentials and season for deployed runs", () => {
    expect(() => resolvePlatformE2eRunConfig(
      { MOCKD_E2E_BASE_URL: "https://staging.mockd.test" },
      [],
    )).toThrow([
      "Deployed platform smoke requires pre-provisioned records.",
      "Missing: MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL, MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD,",
      "MOCKD_E2E_DEPLOYED_MEMBER_EMAIL, MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD, MOCKD_E2E_DEPLOYED_SEASON_ID.",
    ].join(" "));
  });

  it("allows deployed help without requiring a base URL", () => {
    const config = resolvePlatformE2eRunConfig({}, ["--target=deployed", "--help"]);

    expect(config).toMatchObject({
      target: "deployed",
      baseUrl: undefined,
      smokeRunId: undefined,
      helpRequested: true,
    });
  });

  it("reports the source of invalid deployed base URL environment values", () => {
    expect(() => resolvePlatformE2eRunConfig(
      { PLAYWRIGHT_BASE_URL: "mockd.invalid" },
      [],
    )).toThrow("PLAYWRIGHT_BASE_URL must be a valid URL.");
  });

  it("requires an explicit base URL for deployed smoke runs", () => {
    expect(() => resolvePlatformE2eRunConfig(
      { MOCKD_E2E_TARGET: "deployed" },
      [],
    )).toThrow("--base-url or MOCKD_E2E_BASE_URL is required for deployed platform smoke.");
  });

  it("rejects local-only data store config in deployed smoke runs", () => {
    expect(() => resolvePlatformE2eRunConfig(
      {
        MOCKD_E2E_BASE_URL: "https://staging.mockd.test",
        MOCKD_E2E_DATA_FILE: "/tmp/mockd-platform-store.json",
      },
      [],
    )).toThrow("MOCKD_E2E_DATA_FILE only applies to local platform E2E runs.");
  });

  it("rejects fixture bootstrap secrets in deployed smoke runs", () => {
    expect(() => resolvePlatformE2eRunConfig(
      {
        MOCKD_E2E_BASE_URL: "https://staging.mockd.test",
        MOCKD_E2E_PROVISIONING_TOKEN: "must-not-be-used-remotely",
      },
      [],
    )).toThrow("MOCKD_E2E_PROVISIONING_TOKEN only applies to local platform E2E runs.");
  });

  it("accepts the deployed /session route before login", async () => {
    const requests: string[] = [];
    const fetchSession = async (input: URL | RequestInfo): Promise<Response> => {
      requests.push(input.toString());

      return new Response(JSON.stringify({
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    };

    await expect(verifyDeployedPlatformSessionRoute(
      "https://staging.mockd.test",
      fetchSession,
    )).resolves.toBeUndefined();
    expect(requests).toEqual(["https://staging.mockd.test/session"]);
  });

  it("fails loudly when the deployed base URL does not expose the Mockd session route", async () => {
    const fetchSession = async (): Promise<Response> =>
      new Response("<!doctype html><title>wrong app</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    await expect(verifyDeployedPlatformSessionRoute(
      "https://staging.mockd.test",
      fetchSession,
    )).rejects.toThrow("Expected https://staging.mockd.test/session to return Mockd /session JSON.");
  });
});
