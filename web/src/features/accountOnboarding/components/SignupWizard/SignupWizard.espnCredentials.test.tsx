import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  leagueImportFixture,
  syncedConnectionFixture,
} from "../../../leagueConnections/api/leagueConnections.fixture";
import {
  mountWizard,
  pathFor,
  providers,
  requestBody,
} from "../../../../test/SignupWizardTestUtils";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupWizard ESPN credential boundaries", () => {
  it("offers account-wide cookie discovery without requiring a league ID", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathFor(input);
      const method = init?.method ?? "GET";
      const body = init?.body === undefined ? undefined : requestBody(init.body);
      if (path === "/league-connections" && method === "GET") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      if (path === "/league-connections/discover" && body !== undefined) {
        requests.push(body);
        if (!("espnS2" in body)) {
          return Promise.resolve(Response.json({
            error: {
              code: "credentials_required",
              message: "This ESPN league is private.",
            },
          }, { status: 422 }));
        }
        return Promise.resolve(Response.json({
          provider: "espn",
          season: "2026",
          leagues: [{
            providerLeagueId: "899513",
            name: "Private ESPN League",
            season: "2026",
            teamCount: 12,
          }],
        }));
      }
      return Promise.resolve(Response.json({}));
    }));
    const user = userEvent.setup();
    mountWizard("connections", ["espn"]);

    expect(await screen.findByRole("heading", { level: 4, name: "Find every ESPN league" }))
      .toBeVisible();
    expect(screen.queryByRole("textbox", { name: "ESPN league ID or league URL" }))
      .not.toBeInTheDocument();
    await user.type(screen.getByLabelText("espn_s2 cookie"), "private-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{PRIVATE}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    await waitFor(() => { expect(requests).toHaveLength(1); });
    expect(requests[0]).toMatchObject({
      handle: "",
      espnS2: "private-s2",
      swid: "{PRIVATE}",
    });
  });

  it("keeps account credentials when an offline league needs a later format choice", async () => {
    const connectionRequests: Record<string, unknown>[] = [];
    let offlineImportAttempts = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathFor(input);
      const method = init?.method ?? "GET";
      const body = init?.body === undefined ? undefined : requestBody(init.body);
      if (path === "/league-connections" && method === "GET") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      if (path === "/league-connections/discover") {
        return Promise.resolve(Response.json({
          provider: "espn",
          season: "2026",
          leagues: [{
            providerLeagueId: "online-league",
            name: "Online League",
            season: "2026",
            teamCount: 12,
          }, {
            providerLeagueId: "offline-league",
            name: "Offline League",
            season: "2026",
            teamCount: 14,
          }],
        }));
      }
      if (path === "/league-connections" && method === "POST" && body !== undefined) {
        connectionRequests.push(body);
        return Promise.resolve(Response.json({
          connection: {
            ...syncedConnectionFixture,
            id: `connection-${String(body["providerLeagueId"])}`,
            provider: "espn",
            providerLeagueId: body["providerLeagueId"],
          },
        }));
      }
      if (path === "/league-connections/connection-offline-league/import") {
        offlineImportAttempts += 1;
        if (offlineImportAttempts === 1) {
          return Promise.resolve(Response.json({
            error: {
              code: "import_needs_review",
              draftSetup: {
                auctionBudgetDollars: 200,
                minimumBidDollars: 1,
                snakeRounds: 16,
              },
              issues: ["ESPN reports this league's draft type as Offline."],
              message: "Choose Auction or Snake to finish importing this league.",
            },
          }, { status: 422 }));
        }
      }
      if (path.endsWith("/import")) return Promise.resolve(Response.json(leagueImportFixture));
      return Promise.resolve(Response.json({}));
    }));
    const user = userEvent.setup();
    mountWizard("connections", ["espn"]);

    await user.type(await screen.findByLabelText("espn_s2 cookie"), "account-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{ACCOUNT}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));
    await user.click(await screen.findByRole("button", { name: "Import all 2 leagues" }));
    await user.click(await screen.findByRole("combobox", { name: "Draft format" }));
    await user.click(screen.getByRole("option", { name: "Auction" }));
    await user.click(screen.getByRole("button", { name: "Finish import" }));

    await waitFor(() => { expect(offlineImportAttempts).toBe(2); });
    expect(connectionRequests).toHaveLength(3);
    expect(connectionRequests[2]).toMatchObject({
      providerLeagueId: "offline-league",
      credentialMode: "private",
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    });
  });
});
