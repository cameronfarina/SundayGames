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

    expect(await screen.findByRole("link", { name: "Select team" }))
      .toHaveAttribute("href", "/leagues/sleeper-friends-league#claim-your-team");
  });

  it("keeps ESPN account discovery available after an error and retries", async () => {
    const requests: unknown[] = [];
    let credentialAttempts = 0;
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      const body = await request.json();
      requests.push(body);
      credentialAttempts += 1;
      if (credentialAttempts === 1) {
        return platformError(502, "sync_failed", "ESPN could not load your leagues.");
      }
      return HttpResponse.json(espnLeagueOnly);
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    expect(screen.getByRole("heading", { level: 3, name: "Find every ESPN league" }))
      .toBeVisible();
    expect(screen.getByRole("heading", { level: 4, name: "Paste ESPN cookies manually" }))
      .toBeVisible();
    await user.type(screen.getByLabelText("espn_s2 cookie"), "s2-value");
    await user.type(screen.getByLabelText("SWID cookie"), "{{GUID}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    expect(await screen.findByText("ESPN could not load your leagues.")).toBeVisible();
    expect(requests[0]).toEqual({
      provider: "espn",
      handle: "",
      season: "2026",
      espnS2: "s2-value",
      swid: "{GUID}",
    });
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    await waitFor(() => { expect(requests).toHaveLength(2); });
    expect(await screen.findByRole("list", { name: "Leagues found" })).toBeVisible();
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

  it("explains when a Sleeper username has no leagues for the current season", async () => {
    connectionsServer.use(http.post("/league-connections/discover", () => HttpResponse.json({
      leagues: [],
      provider: "sleeper",
      season: "2026",
    })));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(await screen.findByText(
      "No 2026 Sleeper leagues were found for that username.",
    )).toBeVisible();
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
