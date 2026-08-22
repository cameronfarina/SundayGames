import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { connectionsServer, platformError } from "./ConnectionsPage.testServer";
import { renderConnectionsPage } from "./ConnectionsPage.testUtils";

const extensionRequestSchema = z.object({
  channel: z.string(),
  direction: z.literal("to-extension"),
  requestId: z.string(),
  type: z.enum(["read-credentials", "status"]),
});

type CredentialResponse =
  | {
    readonly credentials: { readonly espnS2: string; readonly swid: string };
    readonly type: "credentials";
  }
  | { readonly code: "not_signed_in"; readonly type: "error" };

const bridgeControllers: AbortController[] = [];

const installEspnExtensionBridge = (
  credentialResponse: CredentialResponse = {
    credentials: { espnS2: "extension-s2", swid: "{EXTENSION}" },
    type: "credentials",
  },
): (() => void) => {
  const controller = new AbortController();
  bridgeControllers.push(controller);
  window.addEventListener("message", event => {
    const parsed = extensionRequestSchema.safeParse(event.data);
    if (!parsed.success) return;
    const request = parsed.data;
    const response = request.type === "status"
      ? { type: "status" }
      : credentialResponse;
    window.dispatchEvent(new MessageEvent("message", {
      data: {
        channel: request.channel,
        direction: "to-page",
        requestId: request.requestId,
        ...response,
      },
      origin: window.location.origin,
      source: window,
    }));
  }, { signal: controller.signal });
  return () => { controller.abort(); };
};

describe("ConnectionsPage ESPN browser extension", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => {
    connectionsServer.resetHandlers();
    for (const controller of bridgeControllers.splice(0)) controller.abort();
  });
  afterAll(() => { connectionsServer.close(); });

  it("uses the installed extension for only the private ESPN league entered", async () => {
    const uninstall = installEspnExtensionBridge();
    const discoveryRequests: unknown[] = [];
    const connectionRequests: unknown[] = [];
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      const body = await request.json();
      discoveryRequests.push(body);
      if (typeof body === "object" && body !== null && "espnS2" in body) {
        return HttpResponse.json({
          provider: "espn",
          season: "2026",
          leagues: [{
            providerLeagueId: "899513",
            name: "Private ESPN League",
            season: "2026",
            teamCount: 12,
          }],
        });
      }
      return platformError(422, "credentials_required", "This ESPN league is private.");
    }), http.post("/league-connections", async ({ request }) => {
      connectionRequests.push(await request.json());
      return HttpResponse.json({
        connection: {
          id: "connection-extension",
          provider: "espn",
          providerLeagueId: "899513",
          season: "2026",
          displayName: "Private ESPN League",
          status: "ok",
          lastSyncedAt: "2026-08-22T08:00:00.000Z",
          createdAt: "2026-08-22T08:00:00.000Z",
        },
      });
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "899513",
    );
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));

    await waitFor(() => { expect(discoveryRequests).toHaveLength(2); });
    expect(discoveryRequests[1]).toEqual({
      provider: "espn",
      handle: "899513",
      season: "2026",
      espnS2: "extension-s2",
      swid: "{EXTENSION}",
    });
    expect(screen.queryByLabelText("espn_s2 cookie")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SWID cookie")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {
      name: "Connect and import Private ESPN League",
    }));
    await waitFor(() => { expect(connectionRequests).toHaveLength(1); });
    expect(connectionRequests[0]).toEqual({
      provider: "espn",
      providerLeagueId: "899513",
      displayName: "Private ESPN League",
      season: "2026",
      credentialMode: "private",
      espnS2: "extension-s2",
      swid: "{EXTENSION}",
    });
    uninstall();
  });

  it("asks the owner to sign in when an ESPN session cookie is missing", async () => {
    installEspnExtensionBridge({ code: "not_signed_in", type: "error" });
    let discoveryRequests = 0;
    connectionsServer.use(http.post("/league-connections/discover", () => {
      discoveryRequests += 1;
      return platformError(422, "credentials_required", "This ESPN league is private.");
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "899513",
    );
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));

    expect(await screen.findByText("Sign in to ESPN in this browser, then try again.")).toBeVisible();
    expect(discoveryRequests).toBe(1);
  });
});
