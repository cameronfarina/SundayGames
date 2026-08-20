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

  it("asks ESPN for every league on the account from two cookies", async () => {
    const requests: unknown[] = [];
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json(espnLeagueOnly);
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    expect(screen.getByRole("heading", { name: "Find every league on your ESPN account" }))
      .toBeVisible();
    await user.type(screen.getByLabelText("espn_s2 cookie"), "s2-value");
    await user.type(screen.getByLabelText("SWID cookie"), "{{GUID}");
    await user.click(screen.getByRole("button", { name: "Find all my leagues" }));

    await waitFor(() => { expect(requests).toHaveLength(1); });
    // No league is named: the cookies say who you are, and ESPN answers with all of them.
    expect(requests[0]).toEqual({
      provider: "espn",
      handle: "",
      season: "2026",
      espnS2: "s2-value",
      swid: "{GUID}",
    });
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
