import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connectionsServer, platformError } from "./ConnectionsPage.testServer";
import { renderConnectionsPage } from "./ConnectionsPage.testUtils";

const espnLeagueOnly = {
  provider: "espn",
  season: "2026",
  leagues: [{
    providerLeagueId: "899513",
    name: "Pigskin Power Bottoms",
    season: "2026",
    teamCount: 12,
  }],
};

describe("finding leagues to import", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => { connectionsServer.resetHandlers(); });
  afterAll(() => { connectionsServer.close(); });

  it("finds Sleeper leagues from a username and imports the one chosen", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
    expect(screen.getByText(/Sleeper leagues connect with just a username/u)).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    const importButton = await screen.findByRole("button", {
      name: "Connect and import Sleeper Friends League",
    });
    expect(screen.getByText("2026 season · 12 teams")).toBeVisible();
    await user.click(importButton);

    expect(await screen.findByRole("link", { name: "Open in Sunday Games" }))
      .toHaveAttribute("href", "/leagues/sleeper-friends-league");
  });

  it("keeps private ESPN options available while account discovery fails and retries", async () => {
    const requests: unknown[] = [];
    let rejectAccountDiscovery: (() => void) | undefined;
    let credentialAttempts = 0;
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      const body = await request.json();
      requests.push(body);
      if (typeof body === "object" && body !== null && "espnS2" in body) {
        credentialAttempts += 1;
        if (credentialAttempts === 1) {
          await new Promise<void>(resolve => { rejectAccountDiscovery = resolve; });
          return platformError(502, "sync_failed", "ESPN could not load your leagues.");
        }
        return HttpResponse.json(espnLeagueOnly);
      }
      return platformError(
        422,
        "credentials_required",
        "This ESPN league is private. Paste your espn_s2 and SWID cookies to connect it.",
      );
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "https://fantasy.espn.com/football/league?leagueId=899513",
    );
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    const privateHeading = await screen.findByRole("heading", {
      level: 3,
      name: "This ESPN league is private",
    });
    expect(privateHeading).toHaveFocus();
    expect(screen.getByRole("heading", { level: 4, name: "Make it publicly viewable" }))
      .toBeVisible();
    expect(screen.getByRole("heading", { level: 4, name: "Paste ESPN cookies manually" }))
      .toBeVisible();
    expect(screen.queryByRole("button", { name: /Advanced|Experimental/u })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => { expect(requests).toHaveLength(2); });
    expect(requests[1]).toMatchObject({
      handle: "https://fantasy.espn.com/football/league?leagueId=899513",
    });
    await user.type(screen.getByLabelText("espn_s2 cookie"), "s2-value");
    await user.type(screen.getByLabelText("SWID cookie"), "{{GUID}");
    await user.click(screen.getByRole("button", { name: "Find this private league" }));

    await waitFor(() => { expect(requests).toHaveLength(3); });
    expect(screen.getByRole("heading", { name: "Paste ESPN cookies manually" })).toBeVisible();
    expect(requests[2]).toEqual({
      provider: "espn",
      handle: "https://fantasy.espn.com/football/league?leagueId=899513",
      season: "2026",
      espnS2: "s2-value",
      swid: "{GUID}",
    });
    rejectAccountDiscovery?.();
    expect(await screen.findByText("ESPN could not load your leagues.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Paste ESPN cookies manually" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Find this private league" }));

    await waitFor(() => { expect(requests).toHaveLength(4); });
    expect(await screen.findByRole("list", { name: "Leagues found" })).toBeVisible();
  });

  it("still connects a single ESPN league by its ID", async () => {
    const requests: unknown[] = [];
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json(espnLeagueOnly);
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "https://fantasy.espn.com/football/league?leagueId=899513",
    );
    await user.click(screen.getByRole("button", { name: "Find this league" }));

    await waitFor(() => { expect(requests).toHaveLength(1); });
    expect(requests[0]).toMatchObject({
      handle: "https://fantasy.espn.com/football/league?leagueId=899513",
    });
    expect(await screen.findByRole("button", {
      name: "Connect and import Pigskin Power Bottoms",
    })).toBeVisible();
  });

  it("clears private options for a different ESPN league and announces them again if needed", async () => {
    let lookup = 0;
    connectionsServer.use(http.post("/league-connections/discover", () => {
      lookup += 1;
      if (lookup === 2) {
        return platformError(404, "league_not_found", "ESPN could not find that league.");
      }
      return platformError(422, "credentials_required", "This ESPN league is private.");
    }));
    const user = userEvent.setup();
    renderConnectionsPage();
    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    const handle = screen.getByRole("textbox", { name: "ESPN league ID or league URL" });

    await user.type(handle, "111");
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    expect(await screen.findByRole("heading", { name: "This ESPN league is private" }))
      .toHaveFocus();
    await user.clear(handle);
    await user.type(handle, "222");
    expect(screen.queryByRole("heading", { name: "This ESPN league is private" }))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    expect(await screen.findByText("ESPN could not find that league.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "This ESPN league is private" }))
      .not.toBeInTheDocument();

    await user.clear(handle);
    await user.type(handle, "333");
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    expect(await screen.findByRole("heading", { name: "This ESPN league is private" }))
      .toHaveFocus();
  });

  it("shows a lookup failure as an error rather than an empty list", async () => {
    connectionsServer.use(http.post(
      "/league-connections/discover",
      () => platformError(404, "league_not_found", "Sleeper has no user named \"ghost\"."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "ghost");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(await screen.findByText("Sleeper has no user named \"ghost\".")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Leagues found" })).not.toBeInTheDocument();
  });

  it("explains that Yahoo cannot be connected yet and offers no form", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Yahoo" }));

    expect(screen.getByText(/Yahoo reviews every Fantasy API application/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Find my leagues" })).not.toBeInTheDocument();
  });

  it("keeps the button disabled until a username is typed", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));

    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "  ");
    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeDisabled();
  });

  it("clears an earlier result when the provider changes", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    expect(await screen.findByRole("list", { name: "Leagues found" })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "ESPN" }));

    expect(screen.queryByRole("list", { name: "Leagues found" })).not.toBeInTheDocument();
  });
});
