import { afterEach, describe, expect, it, vi } from "vitest";
import { startPlatformWebFromEnv } from "../../src/platform/startPlatformWeb.js";
import {
  cleanupPlatformWebTest,
  createTemporaryDirectory,
  trackStartedProcess,
} from "./support.js";

afterEach(cleanupPlatformWebTest);

describe("platform web local fixture preview", () => {
  it("starts an explicit local-fixture preview with file-backed storage", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const directory = await createTemporaryDirectory();
    const startedProcess = trackStartedProcess(await startPlatformWebFromEnv({
      HOST: "127.0.0.1",
      MOCKD_PLATFORM_DATA_FILE: `${directory}/platform.json`,
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: `${directory}/draft-tools`,
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    }));

    const response = await fetch(`${startedProcess.server.url}/healthz`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "mockd-platform",
      status: "ok",
    });
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining(
      '"event":"http_request_completed"',
    ));

    const accountResponse = await fetch(`${startedProcess.server.url}/accounts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "preview-user@example.com",
        password: "secure preview password1!",
      }),
    });
    expect(accountResponse.status).toBe(201);
  });

  it("forwards the provisioning token while public signup remains closed", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const directory = await createTemporaryDirectory();
    const startedProcess = trackStartedProcess(await startPlatformWebFromEnv({
      HOST: "127.0.0.1",
      MOCKD_PLATFORM_DATA_FILE: `${directory}/platform.json`,
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: `${directory}/draft-tools`,
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
      MOCKD_PROVISIONING_TOKEN: "local-provisioning-token",
    }));

    const response = await fetch(`${startedProcess.server.url}/accounts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mockd-provisioning-token": "local-provisioning-token",
      },
      body: JSON.stringify({
        email: "provisioned-user@example.com",
        password: "secure provisioned password1!",
      }),
    });
    expect(response.status).toBe(201);
  });
});
