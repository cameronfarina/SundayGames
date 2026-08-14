import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import type { CommissionerKeeper } from "../../api/workspaceSchemas";
import { auctionSeason, jsonResponse, requestPath } from "../../test/commissionerFixtures";
import { KeeperSection } from "./KeeperSection";

const achane = {
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

  it("saves a keeper when the commissioner presses Enter and removes a saved keeper", async () => {
    const bodies: string[] = [];
    const methods: string[] = [];
    const respond: PlatformFetch = (input, init) => {
      bodies.push(typeof init?.body === "string" ? init.body : "");
      methods.push(init?.method ?? "GET");
      const path = requestPath(input);
      if (path.endsWith("/apply")) {
        return Promise.resolve(jsonResponse({ keepers: [achane], preview: {
          team: { name: "Short King" }, player: { name: "De'Von Achane" },
          keeper: { draftType: "auction", auctionCostDollars: 50 },
        } }));
      }
      return Promise.resolve(jsonResponse({ keepers: [] }));
    };
    const fetcher = vi.fn(respond);
    const { client } = renderSection(fetcher);
    const user = userEvent.setup();

    fireEvent.submit(screen.getByRole("form", { name: "Add keeper" }));
    expect(fetcher).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Keeper command"), "cam keeping achane 50{Enter}");
    expect(await screen.findByText("Keeper saved.")).toBeVisible();
    expect(client.getQueryState(seasonQueryKeys.seasonKeepers(auctionSeason.id))?.isInvalidated).toBe(true);
    expect(client.getQueryState(seasonQueryKeys.practiceCatalog(auctionSeason.id, "balanced"))?.isInvalidated).toBe(true);
    client.setQueryData(seasonQueryKeys.seasonKeepers(auctionSeason.id), { keepers: [achane] });
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(client.getQueryState(seasonQueryKeys.seasonKeepers(auctionSeason.id))?.isInvalidated).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodies[0]).toBe(JSON.stringify({ command: "cam keeping achane 50", confirmed: true }));
    expect(methods[1]).toBe("DELETE");
  });

  it("shows empty, round, disabled, and API error states", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "invalid_keeper", message: "No player matched." },
    }, 422)));
    const roundKeeper = { ...achane, playerId: undefined, keeperRound: 3 };
    const view = renderSection(fetcher, [roundKeeper]);
    const user = userEvent.setup();

    expect(screen.getByText("Round 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    await user.type(screen.getByLabelText("Keeper command"), "unknown keeping player 5{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("No player matched.");
    view.rerender(<QueryClientProvider client={new QueryClient()}>
      <KeeperSection keepers={[]} season={auctionSeason} />
    </QueryClientProvider>);
    expect(screen.getByText("No keepers added yet.")).toBeVisible();
  });

  it("reports removal errors and labels keepers from an unavailable team", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "remove_failed", message: "Keeper could not be removed." },
    }, 422)));
    renderSection(fetcher, [{ ...achane, teamId: "unknown-team" }]);
    const user = userEvent.setup();
    expect(screen.getByText(/Team · RB/u)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Keeper could not be removed.");
  });

  it("shows progress while adding or removing a keeper", async () => {
    const pending = new Promise<Response>(() => undefined);
    const view = renderSection(vi.fn(() => pending));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Keeper command"), "cam keeping achane 50{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Saving keeper");
    view.unmount();
    renderSection(vi.fn(() => pending));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });
});
