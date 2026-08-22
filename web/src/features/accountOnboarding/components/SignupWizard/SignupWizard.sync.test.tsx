import { act, screen, waitFor } from "@testing-library/react";
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

const deferredResponse = () => {
  let resolveResponse: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>(resolve => { resolveResponse = resolve; });
  return {
    promise,
    resolve(response: Response) {
      if (resolveResponse === undefined) throw new Error("Response resolver was not initialized.");
      resolveResponse(response);
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupWizard provider setup", () => {
  it("keeps provider cards independent and completes Sleeper discover-to-import", async () => {
    const sleeperDiscovery = deferredResponse();
    const requests: { body?: Record<string, unknown>; method: string; path: string }[] = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathFor(input);
      const method = init?.method ?? "GET";
      const body = init?.body === undefined ? undefined : requestBody(init.body);
      requests.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (path === "/league-connections" && method === "GET") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      if (path === "/league-connections/discover" && body?.["provider"] === "espn") {
        return Promise.resolve(Response.json({ leagues: [], provider: "espn", season: "2026" }));
      }
      if (path === "/league-connections/discover") return sleeperDiscovery.promise;
      if (path === "/league-connections" && method === "POST") {
        return Promise.resolve(Response.json({ connection: syncedConnectionFixture }));
      }
      if (path.endsWith("/import")) return Promise.resolve(Response.json(leagueImportFixture));
      return Promise.resolve(Response.json({}));
    }));
    const user = userEvent.setup();
    mountWizard("connections");
    const espnInput = await screen.findByLabelText("espn_s2 cookie");

    await user.type(espnInput, "espn-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{ESPN}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));
    await waitFor(() => {
      expect(requests.some(request => request.body?.["provider"] === "espn")).toBe(true);
    });
    expect(screen.getByText(
      "No 2026 ESPN leagues were found. For a private account, sign into ESPN and copy fresh " +
      "cookie values.",
    )).toBeVisible();
    const espnRequest = requests.find(request => request.body?.["provider"] === "espn");
    expect(espnRequest?.body).toMatchObject({
      handle: "",
      espnS2: "espn-s2",
      swid: "{ESPN}",
    });

    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    expect(await screen.findByRole("button", { name: "Sync in progress..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await act(async () => {
      sleeperDiscovery.resolve(Response.json({
        provider: "sleeper",
        season: "2026",
        leagues: [{
          providerLeagueId: "289646328504385536",
          name: "Sleeper Friends League",
          season: "2026",
          teamCount: 12,
        }],
      }));
      await sleeperDiscovery.promise;
    });

    await user.click(await screen.findByRole("button", {
      name: "Connect and import Sleeper Friends League",
    }));
    expect(await screen.findByRole("link", { name: "Open in Sunday Games" }))
      .toHaveAttribute("href", "/leagues/sleeper-friends-league");
    expect(espnInput).toHaveValue("espn-s2");
    expect(requests.map(request => [request.method, request.path])).toContainEqual([
      "POST", "/league-connections/connection-sleeper/import",
    ]);
  });
});
