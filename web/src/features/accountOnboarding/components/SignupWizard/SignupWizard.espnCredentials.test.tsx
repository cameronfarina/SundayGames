import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupWizard ESPN credential boundaries", () => {
  it("omits typed private credentials from public discovery and connection", async () => {
    const requests: { body?: Record<string, unknown>; method: string; path: string }[] = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathFor(input);
      const method = init?.method ?? "GET";
      const body = init?.body === undefined ? undefined : requestBody(init.body);
      requests.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (path === "/league-connections" && method === "GET") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      if (path === "/league-connections/discover") {
        return Promise.resolve(Response.json({
          provider: "espn",
          season: "2026",
          leagues: [{
            providerLeagueId: "899513",
            name: "Public ESPN League",
            season: "2026",
            teamCount: 12,
          }],
        }));
      }
      if (path === "/league-connections" && method === "POST") {
        return Promise.resolve(Response.json({
          connection: {
            ...syncedConnectionFixture,
            id: "connection-espn",
            provider: "espn",
            providerLeagueId: "899513",
          },
        }));
      }
      if (path.endsWith("/import")) return Promise.resolve(Response.json(leagueImportFixture));
      return Promise.resolve(Response.json({}));
    }));
    const user = userEvent.setup();
    mountWizard("connections", ["espn"]);

    await user.type(await screen.findByRole("textbox", {
      name: "ESPN league ID or league URL",
    }), "899513");
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    await user.click(await screen.findByRole("button", {
      name: "Connect and import Public ESPN League",
    }));

    await waitFor(() => {
      expect(requests.some(request => request.path === "/league-connections"
        && request.method === "POST")).toBe(true);
    });
    const credentialBearingRequests = requests.filter(request =>
      request.path === "/league-connections/discover"
      || (request.path === "/league-connections" && request.method === "POST"));
    expect(credentialBearingRequests).toHaveLength(2);
    for (const request of credentialBearingRequests) {
      expect(request.body).not.toHaveProperty("espnS2");
      expect(request.body).not.toHaveProperty("swid");
    }
  });

  it("reveals private options only after lookup and discovers every ESPN league with cookies", async () => {
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
        if (body["handle"] !== "") {
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

    expect(await screen.findByRole("textbox", {
      name: "ESPN league ID or league URL",
    })).toBeVisible();
    expect(screen.queryByLabelText("espn_s2 cookie")).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "899513",
    );
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    expect(await screen.findByRole("heading", {
      level: 4,
      name: "This ESPN league is private",
    })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 5, name: "Use ESPN cookies" })).toBeVisible();
    await user.type(screen.getByLabelText("espn_s2 cookie"), "private-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{PRIVATE}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    await waitFor(() => { expect(requests).toHaveLength(2); });
    expect(requests[1]).toMatchObject({
      handle: "",
      espnS2: "private-s2",
      swid: "{PRIVATE}",
    });
  });
});
