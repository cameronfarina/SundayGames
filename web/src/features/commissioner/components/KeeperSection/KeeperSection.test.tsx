import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import type { CommissionerKeeper } from "../../api/workspaceSchemas";
import { auctionSeason, jsonResponse, requestBody } from "../../test/commissionerFixtures";
import { KeeperSection } from "./KeeperSection";

const achane: CommissionerKeeper = {
  teamId: "team-1", playerId: "devon-achane", playerName: "De'Von Achane",
  position: "RB", price: 50,
};

const renderSection = (fetcher: PlatformFetch, keepers: readonly CommissionerKeeper[] = [achane]) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(seasonQueryKeys.commissionerKeepers(auctionSeason.id), { keepers });
  client.setQueryData(seasonQueryKeys.seasonKeepers(auctionSeason.id), { keepers });
  client.setQueryData(seasonQueryKeys.practiceCatalog(auctionSeason.id, "balanced"), { players: [] });
  const view = render(<QueryClientProvider client={client}>
    <KeeperSection keepers={keepers} season={auctionSeason} />
  </QueryClientProvider>);
  return { ...view, client };
};

describe("KeeperSection", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("saves a whole command so several keepers can be typed in a row", async () => {
    const bodies: string[] = [];
    const fetcher: PlatformFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(requestBody(init));
      return Promise.resolve(jsonResponse({
        keepers: [achane],
        preview: {
          team: { name: "Short King" }, player: { name: "De'Von Achane" },
          keeper: { draftType: "auction", auctionCostDollars: 50 },
        },
      }));
    });
    const { client } = renderSection(fetcher);
    const user = userEvent.setup();

    fireEvent.submit(screen.getByRole("form", { name: "Add keeper" }));
    expect(fetcher).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Keeper command"), "cam keeping achane 50{Enter}");

    expect(await screen.findByText("Keeper saved.")).toBeVisible();
    expect(bodies[0]).toBe(JSON.stringify({ command: "cam keeping achane 50", confirmed: true }));
    expect(client.getQueryState(seasonQueryKeys.seasonKeepers(auctionSeason.id))?.isInvalidated).toBe(true);
    expect(client.getQueryState(seasonQueryKeys.practiceCatalog(auctionSeason.id, "balanced"))?.isInvalidated).toBe(true);
  });

  it("counts the keepers already saved", () => {
    renderSection(vi.fn(), [achane, { ...achane, playerId: "tuten", playerName: "Tuten" }]);

    expect(screen.getByText("2 saved")).toBeVisible();
  });

  it("reports why a command was refused", async () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "invalid_keeper", message: "No player matched." },
    }, 422))));

    await userEvent.setup().type(
      screen.getByLabelText("Keeper command"), "unknown keeping player 5{Enter}",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("No player matched.");
  });

  it("shows progress while a keeper saves", async () => {
    renderSection(vi.fn(() => new Promise<Response>(() => undefined)));

    await userEvent.setup().type(
      screen.getByLabelText("Keeper command"), "cam keeping achane 50{Enter}",
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saving keeper");
  });
});
