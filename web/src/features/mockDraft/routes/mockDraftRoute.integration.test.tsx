import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { searchForSeason } from "../../../shared/navigation/seasonSearch";
import { auctionMockResponseFixture } from "../test/auctionMockResponseFixture";
import { MockDraftRoutePage } from "./mockDraftRoute";

afterEach(() => { vi.unstubAllGlobals(); });

const LeagueSwitch = () => {
  const [params, setParams] = useSearchParams();
  return <button
    onClick={() => { setParams(searchForSeason(params, "season-2")); }}
    type="button"
  >Switch league</button>;
};

const Location = () => <output data-testid="location">{useLocation().search}</output>;

const requestedUrl = (input: RequestInfo | URL): string => input instanceof Request
  ? input.url
  : input instanceof URL ? input.href : input;

describe("MockDraftRoutePage league switching", () => {
  it("never requests the previous league session under the next season", async () => {
    const fetcher = vi.fn<PlatformFetch>(() => Promise.resolve(new Response(
      JSON.stringify(auctionMockResponseFixture()),
      { headers: { "content-type": "application/json" } },
    )));
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/mock-drafts?seasonId=season-1&sessionId=mock-1"]}>
          <MockDraftRoutePage />
          <LeagueSwitch />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: "Bid $72" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Switch league" }));

    expect(await screen.findByRole("button", { name: "Create auction mock" })).toBeVisible();
    expect(screen.getByTestId("location")).toHaveTextContent("?seasonId=season-2");
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(1); });
    expect(fetcher.mock.calls.map(call => requestedUrl(call[0]))).not.toContain(
      "/season-mock-drafts/mock-1?seasonId=season-2",
    );
  });
});
