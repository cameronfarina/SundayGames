import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { importedConnectionFixture, providerCatalogFixture } from "../../api/leagueConnections.fixture";
import {
  connectionsServer,
  importReviewError,
  platformError,
} from "./ConnectionsPage.testServer";
import { renderConnectionsPage } from "./ConnectionsPage.testUtils";

const findSleeperLeagues = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("tab", { name: "Sleeper" }));
  await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "feiyingx");
  await user.click(screen.getByRole("button", { name: "Find my leagues" }));
  return await screen.findByRole("list", { name: "Leagues found" });
};

describe("importing connected leagues", () => {
  beforeAll(() => { connectionsServer.listen({ onUnhandledRequest: "error" }); });
  afterEach(() => { connectionsServer.resetHandlers(); });
  afterAll(() => { connectionsServer.close(); });

  it("imports every discovered league in one press", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await findSleeperLeagues(user);
    await user.click(screen.getByRole("button", { name: "Import all" }));

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: "Open in Sunday Games" })).toHaveLength(2);
    });
  });

  it("names every setting that stopped a league from importing", async () => {
    connectionsServer.use(http.post(
      "/league-connections/:connectionId/import",
      () => importReviewError(
        "This league needs a look before it can be imported.",
        ["ESPN roster slot HC is not supported."],
      ),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    const list = await findSleeperLeagues(user);
    await user.click(within(list).getByRole("button", {
      name: "Connect and import Comrades League",
    }));

    expect(await screen.findByText("ESPN roster slot HC is not supported.")).toBeVisible();
    expect(within(list).getByRole("button", { name: "Retry Comrades League" })).toBeVisible();
  });

  it("imports a connection that is already saved, from its card", async () => {
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("button", { name: "Import Sleeper Friends League" }));
    await user.click(await screen.findByRole("button", { name: "Import league" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Import this league" })).not.toBeInTheDocument();
    });
  });

  it("explains a refused import inside the dialog and keeps it open", async () => {
    connectionsServer.use(http.post(
      "/league-connections/:connectionId/import",
      () => platformError(409, "snapshot_required", "Sync this league before importing it."),
    ));
    const user = userEvent.setup();
    renderConnectionsPage();

    await user.click(await screen.findByRole("button", { name: "Import Sleeper Friends League" }));
    await user.click(await screen.findByRole("button", { name: "Import league" }));

    expect(await screen.findByText("Sync this league before importing it.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Import this league" })).not.toBeInTheDocument();
  });

  it("names the league an imported connection produced and offers no second import", async () => {
    connectionsServer.use(http.get("/league-connections", () => HttpResponse.json({
      connections: [importedConnectionFixture],
      providers: providerCatalogFixture,
    })));
    renderConnectionsPage();

    expect(await screen.findByText("Imported as Sleeper Friends League")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Import Sleeper Friends League" }))
      .not.toBeInTheDocument();
  });
});
