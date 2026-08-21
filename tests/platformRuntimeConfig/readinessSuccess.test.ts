import { describe, expect, it } from "vitest";
import {
  assessPlatformProductionReadiness,
  formatPlatformProductionReadinessReport,
  platformProductionReadinessExitCode,
} from "../../src/platform/platformRuntimeConfig.js";

const credentialEncryptionEnv = {
  MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID: "credentials-2026-08",
  MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS: JSON.stringify({
    "credentials-2026-08": Buffer.alloc(32, 11).toString("base64"),
  }),
};

describe("successful platform production readiness", () => {
  it("reports production/domain readiness for a Postgres-backed deploy target", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "443",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
      OPENAI_API_KEY: "production-openai-key",
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "production-resend-key",
      MOCKD_EMAIL_FROM: "Mockd <accounts@mockd.example.com>",
      MOCKD_PUBLIC_BASE_URL: "https://mockd.example.com",
      MOCKD_INVITATION_TOKEN_SECRET: "test-invitation-secret-at-least-32-characters",
      ...credentialEncryptionEnv,
    });

    expect(report).toMatchObject({
      ready: true,
      host: "0.0.0.0",
      port: 443,
      storage: { kind: "postgres", envKey: "DATABASE_URL" },
    });
    expect(report.checks).toEqual([
      {
        status: "pass",
        label: "Postgres durable storage",
        detail: "DATABASE_URL is configured for durable platform storage.",
      },
      {
        status: "pass",
        label: "File-backed storage",
        detail: "MOCKD_PLATFORM_DATA_FILE is not configured.",
      },
      {
        status: "pass",
        label: "Account creation",
        detail: "Public account creation is enabled; league access still requires membership or an invitation.",
      },
      {
        status: "pass",
        label: "Account email delivery",
        detail: "Resend delivery, sender identity, and the public HTTPS origin are configured.",
      },
      {
        status: "pass",
        label: "League invitation signing",
        detail: "A durable league invitation signing secret is configured.",
      },
      {
        status: "pass",
        label: "ESPN credential encryption",
        detail: "A versioned active encryption key is configured for stored ESPN credentials.",
      },
      {
        status: "pass",
        label: "Live draft data",
        detail: "Live draft data is configured for Postgres with capacity for 650 streams.",
      },
      {
        status: "pass",
        label: "Private draft storage",
        detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is configured.",
      },
      {
        status: "pass",
        label: "Web bind target",
        detail: "Host 0.0.0.0, port 443.",
      },
      {
        status: "pass",
        label: "Screenshot import",
        detail: "OpenAI screenshot analysis is configured.",
      },
      {
        status: "pass",
        label: "FantasyPros sync",
        detail: "FantasyPros rankings and projections are disabled; set FANTASYPROS_API_KEY to enable them.",
      },
    ]);
    expect(report.nextSteps.join("\n")).toContain("npm run platform:migrate");
    expect(report.nextSteps.join("\n")).toContain("MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY");
    expect(report.nextSteps.join("\n")).toContain("Create a commissioner account");
    expect(report.nextSteps.join("\n")).toContain("npm run smoke");
    expect(platformProductionReadinessExitCode(report)).toBe(0);

    const formatted = formatPlatformProductionReadinessReport(report);
    expect(formatted).toContain("Mockd production/domain readiness: READY");
    expect(formatted).toContain("Web bind: 0.0.0.0:443");
    expect(formatted).toContain("PASS Postgres durable storage - DATABASE_URL is configured");
  });

  it("reports manual commissioner entry as ready without OpenAI configuration", () => {
    const report = assessPlatformProductionReadiness({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      HOST: "0.0.0.0",
      PORT: "4361",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_SCREENSHOT_IMPORT_MODE: "disabled",
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "production-resend-key",
      MOCKD_EMAIL_FROM: "Mockd <accounts@mockd.example.com>",
      MOCKD_PUBLIC_BASE_URL: "https://mockd.example.com",
      MOCKD_INVITATION_TOKEN_SECRET: "test-invitation-secret-at-least-32-characters",
      ...credentialEncryptionEnv,
    });

    expect(report.ready).toBe(true);
    expect(report.checks).toContainEqual({
      status: "pass",
      label: "Screenshot import",
      detail: "Commissioner setup uses manual entry; OpenAI screenshot analysis is optional.",
    });
    expect(report.nextSteps.join("\n")).toContain(
      "Optional: set MOCKD_SCREENSHOT_IMPORT_MODE=openai",
    );
  });
});
