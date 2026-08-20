import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { syncedConnectionFixture } from "../../api/leagueConnections.fixture";
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

const chooseProvider = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole("tab", { name }));
};

describe("connecting a league", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => { connectionsServer.resetHandlers(); });
  afterAll(() => { connectionsServer.close(); });

  it("finds Sleeper leagues, marks linked ones, and imports another league", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "Sleeper");
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(await screen.findByText("Already linked")).toBeVisible();
    expect(screen.getByRole("button", { name: "Import Sleeper Friends League" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Import Comrades League" }));

    expect(await screen.findByText("Imported")).toBeVisible();
  });

  it("discovers every ESPN league from cookies without requiring a league id", async () => {
    const requests: unknown[] = [];
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json(espnLeagueOnly);
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "ESPN");
    expect(screen.getByRole("heading", { name: "Connect your ESPN account" })).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "espn_s2 cookie" }), "s2-value");
    await user.type(screen.getByRole("textbox", { name: "SWID cookie" }), "{{GUID}");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(await screen.findByRole("button", { name: "Import Pigskin Power Bottoms" })).toBeVisible();
    expect(requests[0]).toMatchObject({
      provider: "espn",
      handle: "",
      espnS2: "s2-value",
      swid: "{GUID}",
    });
  });

  it("still supports importing one ESPN league by URL without cookies", async () => {
    const saved: unknown[] = [];
    connectionsServer.use(
      http.post("/league-connections/discover", () => HttpResponse.json(espnLeagueOnly)),
      http.post("/league-connections", async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ connection: syncedConnectionFixture });
      }),
    );
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "ESPN");
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL (optional)" }),
      "https://fantasy.espn.com/football/league?leagueId=899513",
    );
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    await user.click(await screen.findByRole("button", { name: "Import Pigskin Power Bottoms" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]).toMatchObject({ provider: "espn", providerLeagueId: "899513" });
    expect(saved[0]).not.toHaveProperty("espnS2");
  });

  it("can overwrite an explicitly selected existing Sunday Games league", async () => {
    const saved: unknown[] = [];
    connectionsServer.use(
      http.post("/league-connections/discover", () => HttpResponse.json(espnLeagueOnly)),
      http.post("/league-connections", async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ connection: syncedConnectionFixture });
      }),
    );
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "ESPN");
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL (optional)" }),
      "899513",
    );
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    const destination = await screen.findByRole("combobox", { name: "Import destination" });
    await user.click(destination);
    await user.click(await screen.findByRole("option", { name: "Overwrite Manual Home League" }));
    await user.click(screen.getByRole("button", { name: "Import Pigskin Power Bottoms" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]).toMatchObject({ targetSeasonId: "season-manual-2026" });
  });

  it("keeps ESPN instructions visible and reports rejected cookies", async () => {
    connectionsServer.use(http.post(
      "/league-connections/discover",
      () => platformError(422, "credentials_rejected", "Those ESPN cookies no longer work."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "ESPN");
    await user.type(screen.getByRole("textbox", { name: "espn_s2 cookie" }), "bad-cookie");
    await user.type(screen.getByRole("textbox", { name: "SWID cookie" }), "{{GUID}");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(await screen.findByText("Those ESPN cookies no longer work.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Connect your ESPN account" })).toBeVisible();
  });

  it("shows ordinary provider failures without turning them into credential prompts", async () => {
    connectionsServer.use(http.post(
      "/league-connections/discover",
      () => platformError(404, "league_not_found", "Sleeper has no user named \"ghost\"."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "Sleeper");
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "ghost");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(await screen.findByText("Sleeper has no user named \"ghost\".")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Connect your ESPN account" }))
      .not.toBeInTheDocument();
  });

  it("explains that Yahoo cannot be connected yet and offers no form", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "Yahoo");

    expect(screen.getByText(/Yahoo reviews every Fantasy API application/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Find my leagues" })).not.toBeInTheDocument();
  });

  it("requires a Sleeper username but accepts complete ESPN cookies with no handle", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "Sleeper");
    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeDisabled();

    await chooseProvider(user, "ESPN");
    const find = screen.getByRole("button", { name: "Find my leagues" });
    expect(find).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "espn_s2 cookie" }), "s2-value");
    expect(find).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "SWID cookie" }), "{{GUID}");
    expect(find).toBeEnabled();
  });

  it("clears discovered results when the provider changes", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "Sleeper");
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    expect(await screen.findByRole("list", { name: "Leagues found" })).toBeVisible();

    await chooseProvider(user, "ESPN");

    expect(screen.queryByRole("list", { name: "Leagues found" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect your ESPN account" })).toBeVisible();
  });

  it("keeps search results visible when one league import fails", async () => {
    connectionsServer.use(http.post(
      "/league-connections",
      () => platformError(502, "provider_unreachable", "Sleeper did not respond."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "Sleeper");
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    await user.click(await screen.findByRole("button", { name: "Import Comrades League" }));

    expect(await screen.findByText("Sleeper did not respond.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry Comrades League" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Leagues found" })).toBeVisible();
  });

  it("imports every unlinked discovered league from the bulk action", async () => {
    const saved: unknown[] = [];
    connectionsServer.use(http.post("/league-connections", async ({ request }) => {
      saved.push(await request.json());
      return HttpResponse.json({ connection: syncedConnectionFixture });
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await chooseProvider(user, "Sleeper");
    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    await user.click(await screen.findByRole("button", { name: "Import all leagues" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]).toMatchObject({ providerLeagueId: "330813448747253760" });
  });
});
