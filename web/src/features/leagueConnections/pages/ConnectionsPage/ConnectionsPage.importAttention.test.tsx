import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { needsAttentionConnectionFixture } from "../../api/leagueConnections.fixture";
import { connectionsServer } from "./ConnectionsPage.testServer";
import { renderConnectionsPage } from "./ConnectionsPage.testUtils";

const espnLeague = {
  provider: "espn",
  season: "2026",
  leagues: [{
    providerLeagueId: "899513",
    name: "Pigskin Power Bottoms",
    season: "2026",
    teamCount: 12,
  }],
};

describe("league import review state", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => { connectionsServer.resetHandlers(); });
  afterAll(() => { connectionsServer.close(); });

  it("does not claim success until the provider league is linked to a real league", async () => {
    connectionsServer.use(
      http.post("/league-connections/discover", () => HttpResponse.json(espnLeague)),
      http.post("/league-connections", () => HttpResponse.json({
        connection: {
          ...needsAttentionConnectionFixture,
          statusDetail: "Confirm this league's draft type and draft settings before importing it.",
        },
      })),
    );
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL (optional)" }),
      "899513",
    );
    await user.click(screen.getByRole("button", { name: "Find my leagues" }));
    await user.click(await screen.findByRole("button", { name: "Import Pigskin Power Bottoms" }));

    expect(await screen.findByText(
      "Needs attention: Confirm this league's draft type and draft settings before importing it.",
    )).toBeVisible();
    expect(screen.queryByText("Imported")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Pigskin Power Bottoms" })).toBeVisible();
  });
});
