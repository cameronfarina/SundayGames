import { describe, expect, it } from "vitest";
import { readPlatformWebRuntimeConfig } from "../../src/platform/platformRuntimeConfig.js";

describe("platform web runtime config", () => {
  it("requires explicit shared storage settings for the default web mode", () => {
    expect(() => readPlatformWebRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
    })).toThrow(
      "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is required for Postgres-backed web startup.",
    );
    expect(() => readPlatformWebRuntimeConfig({
      DATABASE_URL: "file:/tmp/mockd-platform.json",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
    })).toThrow("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  });

  it("requires production email verification delivery and an HTTPS public origin", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_INVITATION_TOKEN_SECRET: "test-invitation-secret-at-least-32-characters",
    };
    expect(() => readPlatformWebRuntimeConfig(base)).toThrow(
      "MOCKD_AUTH_EMAIL_MODE=resend is required in production.",
    );
    expect(() => readPlatformWebRuntimeConfig({
      ...base,
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "secret",
      MOCKD_EMAIL_FROM: "accounts@mockd.example.com",
      MOCKD_PUBLIC_BASE_URL: "http://mockd.example.com/path",
    })).toThrow("MOCKD_PUBLIC_BASE_URL must be a valid HTTPS origin.");
    expect(readPlatformWebRuntimeConfig({
      ...base,
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "secret",
      MOCKD_EMAIL_FROM: "accounts@mockd.example.com",
      MOCKD_PUBLIC_BASE_URL: "https://mockd.example.com",
      MOCKD_INVITATION_TOKEN_SECRET: "test-invitation-secret-at-least-32-characters",
    }).authEmail.mode).toBe("resend");
  });
});
