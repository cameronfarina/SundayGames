import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { discoveredLeaguesFixture } from "../../api/leagueConnections.fixture";
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

describe("connecting a league", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => { connectionsServer.resetHandlers(); });
  afterAll(() => { connectionsServer.close(); });

  it("finds Sleeper leagues from a username and connects the one chosen", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
    expect(screen.getByText(/Sleeper leagues connect with just a username/u)).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    const connectButton = await screen.findByRole("button", {
      name: "Connect Sleeper Friends League",
    });
    expect(screen.getByText("2026 season · 12 teams")).toBeVisible();
    await user.click(connectButton);

    await waitFor(() => {
      expect(screen.queryByRole("list", { name: "Leagues found" })).toBeNull();
    });
  });

  it("connects a public ESPN league from its URL without a second step", async () => {
    const saved: unknown[] = [];
    connectionsServer.use(
      http.post("/league-connections/discover", () => HttpResponse.json(espnLeagueOnly)),
      http.post("/league-connections", async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ connection: discoveredLeaguesFixture.leagues[0] });
      }),
    );
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "https://fantasy.espn.com/football/league?leagueId=899513",
    );
    await user.click(screen.getByRole("button", { name: "Connect league" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]).toMatchObject({ provider: "espn", providerLeagueId: "899513" });
    // Never asked for cookies, because ESPN never refused.
    expect(screen.queryByRole("textbox", { name: "espn_s2 cookie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Leagues found" })).not.toBeInTheDocument();
  });

  it("reveals the cookie step only after ESPN refuses a private league", async () => {
    connectionsServer.use(http.post(
      "/league-connections/discover",
      () => platformError(
        422,
        "credentials_required",
        "This ESPN league is private. Paste your espn_s2 and SWID cookies to connect it.",
      ),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    expect(screen.queryByRole("heading", { name: "This league is private" }))
      .not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "ESPN league ID or league URL" }), "1");
    await user.click(screen.getByRole("button", { name: "Connect league" }));

    expect(await screen.findByRole("heading", { name: "This league is private" })).toBeVisible();
    expect(screen.getByRole("link", { name: "fantasy.espn.com" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again with these cookies" })).toBeVisible();
  });

  it("retries with the pasted cookies and connects the private league", async () => {
    const requests: unknown[] = [];
    let refuse = true;
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      requests.push(await request.json());
      if (!refuse) return HttpResponse.json(espnLeagueOnly);
      refuse = false;
      return platformError(422, "credentials_required", "This ESPN league is private.");
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(screen.getByRole("textbox", { name: "ESPN league ID or league URL" }), "1");
    await user.click(screen.getByRole("button", { name: "Connect league" }));

    await user.type(
      await screen.findByRole("textbox", { name: "espn_s2 cookie" }),
      "s2-value",
    );
    await user.type(screen.getByRole("textbox", { name: "SWID cookie" }), "{{GUID}");
    await user.click(screen.getByRole("button", { name: "Try again with these cookies" }));

    await waitFor(() => { expect(requests).toHaveLength(2); });
    expect(requests[0]).not.toHaveProperty("espnS2");
    expect(requests[1]).toMatchObject({ espnS2: "s2-value", swid: "{GUID}" });
  });

  it("keeps the cookie step up and explains when the pasted cookies are rejected", async () => {
    connectionsServer.use(http.post(
      "/league-connections/discover",
      () => platformError(422, "credentials_rejected", "Those ESPN cookies no longer work."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(screen.getByRole("textbox", { name: "ESPN league ID or league URL" }), "1");
    await user.click(screen.getByRole("button", { name: "Connect league" }));

    expect(await screen.findByRole("heading", { name: "This league is private" })).toBeVisible();
  });

  it("shows an ordinary failure as an error rather than asking for cookies", async () => {
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
    expect(screen.queryByRole("heading", { name: "This league is private" }))
      .not.toBeInTheDocument();
  });

  it("explains that Yahoo cannot be connected yet and offers no form", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Yahoo" }));

    expect(screen.getByText(/Yahoo reviews every Fantasy API application/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Connect league" })).not.toBeInTheDocument();
  });

  it("keeps the button disabled until a league or username is typed", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));

    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "  ");
    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeDisabled();
  });

  it("clears an earlier result and the cookie step when the provider changes", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    expect(await screen.findByRole("list", { name: "Leagues found" })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "ESPN" }));

    expect(screen.queryByRole("list", { name: "Leagues found" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "This league is private" }))
      .not.toBeInTheDocument();
  });

  it("reports a failure to save the connection without losing the search results", async () => {
    connectionsServer.use(http.post(
      "/league-connections",
      () => platformError(502, "provider_unreachable", "Sleeper did not respond."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    await user.click(await screen.findByRole("button", { name: "Connect Comrades League" }));

    expect(await screen.findByText("Sleeper did not respond.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Connect Comrades League" })).toBeVisible();
  });
});
