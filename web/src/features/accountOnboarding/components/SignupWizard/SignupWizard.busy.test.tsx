import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  leagueImportFixture,
  syncedConnectionFixture,
} from "../../../leagueConnections/api/leagueConnections.fixture";
import { mountWizard, pathFor, providers, requestBody } from "../../../../test/SignupWizardTestUtils";

const deferredResponse = () => {
  let resolveResponse: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>(resolve => { resolveResponse = resolve; });
  return {
    promise,
    resolve(response: Response) {
      if (resolveResponse === undefined) throw new Error("Missing response resolver.");
      resolveResponse(response);
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupWizard provider busy controls", () => {
  it("keeps provider and navigation actions disabled through connect and import", async () => {
    const connect = deferredResponse();
    const importLeague = deferredResponse();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathFor(input);
      const method = init?.method ?? "GET";
      const body = init?.body === undefined ? undefined : requestBody(init.body);
      if (path === "/league-connections" && method === "GET") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      if (path === "/league-connections/discover") {
        if (body?.["provider"] === "espn") {
          return Promise.resolve(Response.json({
            provider: "espn",
            season: "2026",
            leagues: [{
              providerLeagueId: "899513",
              name: "ESPN Friends League",
              season: "2026",
              teamCount: 12,
            }],
          }));
        }
        return Promise.resolve(Response.json({
          provider: "sleeper",
          season: "2026",
          leagues: [{
            providerLeagueId: "289646328504385536",
            name: "Sleeper Friends League",
            season: "2026",
            teamCount: 12,
          }],
        }));
      }
      if (path === "/league-connections" && method === "POST"
        && body?.["provider"] === "sleeper") return connect.promise;
      if (path.endsWith("/import")) return importLeague.promise;
      return Promise.resolve(Response.json({}));
    }));
    const user = userEvent.setup();
    mountWizard("connections");
    const espnInput = await screen.findByRole("textbox", { name: "ESPN league ID or league URL" });
    const sleeperInput = screen.getByRole("textbox", { name: "Sleeper username" });
    await user.type(espnInput, "899513");
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    await screen.findByRole("button", { name: "Connect and import ESPN Friends League" });
    await user.type(sleeperInput, "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    await user.click(await screen.findByRole("button", {
      name: "Connect and import Sleeper Friends League",
    }));

    const finish = screen.getByRole("button", { name: "Sync in progress..." });
    expect(finish).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "Looking..." })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button", { name: "Import all" })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByRole("button", {
      name: "Connect and import ESPN Friends League",
    })).toBeDisabled();
    expect(espnInput).toBeDisabled();
    expect(sleeperInput).toBeDisabled();

    await act(async () => {
      connect.resolve(Response.json({ connection: syncedConnectionFixture }));
      await connect.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sync in progress..." })).toBeDisabled();
    });
    await act(async () => {
      importLeague.resolve(Response.json(leagueImportFixture));
      await importLeague.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finish setup" })).toBeEnabled();
    });
  });
});
