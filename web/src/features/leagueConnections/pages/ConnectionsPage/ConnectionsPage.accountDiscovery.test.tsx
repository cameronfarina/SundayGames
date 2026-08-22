import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connectionsServer, platformError } from "./ConnectionsPage.testServer";
import { renderConnectionsPage } from "./ConnectionsPage.testUtils";

describe("ESPN account discovery", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => { connectionsServer.resetHandlers(); });
  afterAll(() => { connectionsServer.close(); });

  it("discovers every account league from cookies without requiring a league ID", async () => {
    const requests: unknown[] = [];
    connectionsServer.use(http.post("/league-connections/discover", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({
        provider: "espn",
        season: "2026",
        leagues: [{
          providerLeagueId: "899513",
          name: "Pigskin Power Bottoms",
          season: "2026",
          teamCount: 12,
        }],
      });
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    expect(screen.getByRole("heading", { name: "Find every ESPN league" })).toBeVisible();
    await user.type(screen.getByLabelText("espn_s2 cookie"), "account-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{ACCOUNT}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    await waitFor(() => { expect(requests).toHaveLength(1); });
    expect(requests[0]).toEqual({
      provider: "espn",
      handle: "",
      season: "2026",
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    });
    expect(await screen.findByRole("button", {
      name: "Connect and import Pigskin Power Bottoms",
    })).toBeVisible();
  });

  it("does not label account-wide discovery as a private league while pending or empty", async () => {
    let finishDiscovery: (() => void) | undefined;
    connectionsServer.use(http.post("/league-connections/discover", async () => {
      await new Promise<void>(resolve => { finishDiscovery = resolve; });
      return HttpResponse.json({ provider: "espn", season: "2026", leagues: [] });
    }));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(screen.getByLabelText("espn_s2 cookie"), "account-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{ACCOUNT}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    expect(screen.queryByRole("heading", { name: "This ESPN league is private" }))
      .not.toBeInTheDocument();
    finishDiscovery?.();
    expect(await screen.findByText(/No 2026 ESPN leagues were found/u)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "This ESPN league is private" }))
      .not.toBeInTheDocument();
  });

  it("shows rejected account cookies without mislabeling a league as private", async () => {
    connectionsServer.use(http.post(
      "/league-connections/discover",
      () => platformError(422, "credentials_rejected", "ESPN rejected those cookie values."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("tab", { name: "ESPN" }));
    await user.type(screen.getByLabelText("espn_s2 cookie"), "expired-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{ACCOUNT}");
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    expect(await screen.findByText("ESPN rejected those cookie values.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "This ESPN league is private" }))
      .not.toBeInTheDocument();
  });
});
