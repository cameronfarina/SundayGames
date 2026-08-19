import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapturingAuthMailSender, CapturingSignupNotifier } from "../src/platform/auth.js";
import { NodePostgresClient } from "../src/platform/postgresClient.js";
import { readPlatformRuntimeConfig } from "../src/platform/platformRuntimeConfig.js";
import { importEspnLeagueSettingsForRuntime } from "../src/platform/startPlatformWeb/espnImporter.js";
import { createPlatformWebReadinessProbe } from "../src/platform/startPlatformWeb/readiness.js";
import {
  authMailSenderFor,
  screenshotAnalyzerFor,
  signupNotifierFor,
} from "../src/platform/startPlatformWeb/runtimeServices.js";
import { staticWebAssetsFor } from "../src/platform/startPlatformWeb/staticAssets.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  vi.unstubAllGlobals();
  if (temporaryDirectory !== undefined) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = undefined;
  }
});

const localConfig = (env: NodeJS.ProcessEnv = {}) => readPlatformRuntimeConfig({
  MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
  MOCKD_PLATFORM_DATA_FILE: "/tmp/mockd-platform.json",
  ...env,
});

describe("platform web runtime services", () => {
  it("uses injected assets, skips test assets, and loads production assets", async () => {
    const injected = { indexHtml: "injected", files: new Map() };
    await expect(staticWebAssetsFor({}, { staticWebAssets: injected })).resolves.toBe(injected);
    await expect(staticWebAssetsFor({ NODE_ENV: "test" }, {})).resolves.toBeUndefined();

    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-web-assets-"));
    await writeFile(join(temporaryDirectory, "index.html"), "<main>Mockd</main>");
    await writeFile(join(temporaryDirectory, "app.js"), "export {};");
    const assets = await staticWebAssetsFor({
      NODE_ENV: "production",
      MOCKD_WEB_ASSETS_DIRECTORY: temporaryDirectory,
    }, {});

    expect(assets?.indexHtml).toBe("<main>Mockd</main>");
    expect(await readFile(join(temporaryDirectory, "app.js"), "utf8")).toBe("export {};");
    expect(assets?.files.has("/app.js")).toBe(true);
  });

  it("selects configured auth and screenshot services", () => {
    const injected = new CapturingAuthMailSender();
    expect(authMailSenderFor(localConfig(), injected)).toBe(injected);
    expect(authMailSenderFor(localConfig(), undefined)).toBeUndefined();
    expect(authMailSenderFor(localConfig({
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "resend-key",
      MOCKD_EMAIL_FROM: "accounts@mockd.example",
    }), undefined)).toBeDefined();
    expect(screenshotAnalyzerFor(localConfig())).toBeUndefined();
    expect(screenshotAnalyzerFor(localConfig({
      MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
      OPENAI_API_KEY: "openai-key",
    }))).toBeDefined();

    const injectedNotifier = new CapturingSignupNotifier();
    expect(signupNotifierFor(localConfig(), injectedNotifier)).toBe(injectedNotifier);
    expect(signupNotifierFor(localConfig(), undefined)).toBeUndefined();
    expect(signupNotifierFor(localConfig({
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "resend-key",
      MOCKD_EMAIL_FROM: "accounts@mockd.example",
    }), undefined)).toBeUndefined();
    expect(signupNotifierFor(localConfig({
      MOCKD_AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "resend-key",
      MOCKD_EMAIL_FROM: "accounts@mockd.example",
      MOCKD_SIGNUP_NOTIFICATION_EMAIL: "owner@example.com",
    }), undefined)).toBeDefined();
  });

  it("parses JSON and preserves non-JSON ESPN responses", async () => {
    const responses = [
      new Response(JSON.stringify({ message: "private" }), { status: 403 }),
      new Response("not-json", { status: 403 }),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("Unexpected ESPN request.");
      return response;
    }));

    const first = await importEspnLeagueSettingsForRuntime({ leagueIdOrUrl: 123, season: 2026 });
    const second = await importEspnLeagueSettingsForRuntime({ leagueIdOrUrl: 123, season: 2026 });

    expect(first).toMatchObject({ kind: "manual-review-required" });
    expect(second).toMatchObject({ kind: "manual-review-required" });
  });

  it("reports writable local storage and failed Postgres readiness", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-readiness-"));
    await expect(createPlatformWebReadinessProbe({
      liveDraftDataMode: "local-fixtures",
      draftToolsSessionDirectory: temporaryDirectory,
    }, undefined)()).resolves.toBe(true);
    await expect(createPlatformWebReadinessProbe({
      liveDraftDataMode: "local-fixtures",
      draftToolsSessionDirectory: "/dev/null/not-writable",
    }, undefined)()).resolves.toBe(false);

    const postgres = new NodePostgresClient({
      query: async () => { throw new Error("database unavailable"); },
      connect: async () => { throw new Error("No transaction expected."); },
      end: async () => undefined,
    });
    await expect(createPlatformWebReadinessProbe({
      liveDraftDataMode: "postgres",
      draftToolsSessionDirectory: temporaryDirectory,
    }, postgres)()).resolves.toBe(false);
  });
});
