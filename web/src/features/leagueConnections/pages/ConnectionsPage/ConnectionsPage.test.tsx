import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  importedConnectionFixture,
  needsAttentionConnectionFixture,
  providerCatalogFixture,
} from "../../api/leagueConnections.fixture";
import type { LeagueConnection } from "../../api/leagueConnectionsSchema";
import { connectionsServer, onboardingFixture, platformError } from "./ConnectionsPage.testServer";
import { renderConnectionsPage } from "./ConnectionsPage.testUtils";

describe("ConnectionsPage", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => { connectionsServer.resetHandlers(); });
  afterAll(() => { connectionsServer.close(); });

  it("lists connected leagues with a status the owner can act on", async () => {
    renderConnectionsPage();

    expect(await screen.findByRole("heading", { name: "Connections" })).toBeVisible();
    expect(await screen.findByText("Sleeper Friends League")).toBeVisible();
    expect(screen.getByText("Synced")).toBeVisible();
    expect(screen.getByText("Needs attention")).toBeVisible();
    expect(screen.getByText(/Paste your espn_s2 and SWID cookies/u)).toBeVisible();
  });

  it("opens a league's teams and matchups from the connection card", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("button", { name: "View Sleeper Friends League" }));

    expect(await screen.findByRole("heading", { name: "Sleeper Friends League", level: 2 }))
      .toBeVisible();
    expect(screen.getByText("Giant Dolphins")).toBeVisible();
    expect(screen.getByText("Alvin Kamara")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Matchups (2)" }));
    expect(screen.getByRole("table", { name: /Weekly matchups/u })).toBeVisible();
  });

  it("brings the opened league into view, and again when another card is chosen", async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("button", { name: "View Sleeper Friends League" }));
    await waitFor(() => { expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" }); });

    // The detail is already on the page, so only the selection changes.
    scrollIntoView.mockClear();
    await user.click(screen.getByRole("button", { name: "View Pigskin Power Bottoms" }));

    await waitFor(() => { expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" }); });
    scrollIntoView.mockRestore();
  });

  it("closes the league again when the same card is chosen twice", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    const viewButton = await screen.findByRole("button", {
      name: "View Sleeper Friends League",
    });
    await user.click(viewButton);
    expect(await screen.findByText("Giant Dolphins")).toBeVisible();
    await user.click(viewButton);

    await waitFor(() => { expect(screen.queryByText("Giant Dolphins")).not.toBeInTheDocument(); });
  });

  it("explains a connection that has no league stored yet", async () => {
    connectionsServer.use(http.get("/league-connections/:connectionId", () => HttpResponse.json({
      connection: needsAttentionConnectionFixture,
      league: null,
    })));
    const user = userEvent.setup();
    renderConnectionsPage("/connections?connection=connection-espn");

    expect(await screen.findByRole("heading", { name: "Pigskin Power Bottoms", level: 2 }))
      .toBeVisible();
    await user.click(screen.getByRole("button", { name: "View Pigskin Power Bottoms" }));
  });

  it("reports a failure to load the league rather than showing an empty page", async () => {
    connectionsServer.use(http.get(
      "/league-connections/:connectionId",
      () => platformError(502, "provider_unreachable", "Sleeper did not respond."),
    ));
    renderConnectionsPage("/connections?connection=connection-sleeper");

    expect(await screen.findByText("Sleeper did not respond.")).toBeVisible();
  });

  it("reports a failure to load the connection list", async () => {
    connectionsServer.use(http.get(
      "/league-connections",
      () => platformError(503, "league_connections_unavailable", "Connected leagues are off."),
    ));
    renderConnectionsPage();

    expect(await screen.findByText("Connected leagues are off.")).toBeVisible();
  });

  it("sends an ESPN league that needs attention to reconnect and can disconnect another", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("link", { name: "Reconnect ESPN" }));
    expect(screen.getByRole("heading", { name: "Connect a league" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Disconnect Sleeper Friends League" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Reconnect ESPN" })).toBeVisible();
    });
  });

  it("offers no sync on a league that is already up to date", async () => {
    renderConnectionsPage();

    expect(await screen.findByText("Sleeper Friends League")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sync Sleeper Friends League now" }))
      .not.toBeInTheDocument();
  });

  it("retries a non-ESPN connection that needs attention", async () => {
    const user = userEvent.setup();
    const sleeperNeedsAttention: LeagueConnection = {
      ...needsAttentionConnectionFixture,
      provider: "sleeper",
    };
    connectionsServer.use(http.get("/league-connections", () => HttpResponse.json({
      connections: [sleeperNeedsAttention],
      providers: providerCatalogFixture,
    })));
    renderConnectionsPage();

    const syncButton = await screen.findByRole("button", {
      name: `Sync ${sleeperNeedsAttention.displayName} now`,
    });
    await user.click(syncButton);

    await waitFor(() => { expect(syncButton).toBeEnabled(); });
  });

  it("marks an imported workspace that still needs a team and links to the picker", async () => {
    connectionsServer.use(
      http.get("/league-connections", () => HttpResponse.json({
        connections: [importedConnectionFixture],
        providers: providerCatalogFixture,
      })),
      http.get("/onboarding", () => HttpResponse.json({
        ...onboardingFixture,
        leagues: [{
          ...onboardingFixture.leagues[0],
          leagueName: "Sleeper Friends League",
          leagueSlug: "sleeper-friends-league",
          membership: { role: "owner" },
          readiness: {
            ...onboardingFixture.leagues[0]?.readiness,
            teamClaim: "needs_attention",
          },
          seasonId: "season-imported",
        }],
      })),
    );
    renderConnectionsPage();

    expect(await screen.findByText("Team not selected")).toBeVisible();
    expect(screen.getByRole("link", { name: "Select team" }))
      .toHaveAttribute("href", "/leagues/sleeper-friends-league#claim-your-team");
  });

  it("clears the open league when that connection is disconnected", async () => {
    const user = userEvent.setup();
    renderConnectionsPage("/connections?connection=connection-sleeper");

    expect(await screen.findByText("Giant Dolphins")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Disconnect Sleeper Friends League" }));

    await waitFor(() => { expect(screen.queryByText("Giant Dolphins")).not.toBeInTheDocument(); });
  });

  it("shows an empty state before any league is connected", async () => {
    connectionsServer.use(http.get("/league-connections", () => HttpResponse.json({
      connections: [],
      providers: providerCatalogFixture,
    })));
    renderConnectionsPage();

    expect(await screen.findByText("No leagues connected yet")).toBeVisible();
  });
});
