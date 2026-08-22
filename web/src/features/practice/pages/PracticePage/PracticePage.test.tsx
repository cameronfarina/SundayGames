import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { PracticePage } from "./PracticePage";
import { createPracticeFetch } from "./test/createPracticeFetch";
import { league } from "./test/practiceFixtures";
import { stubPracticeSimulationWorker } from "./test/stubPracticeSimulationWorker";

afterEach(() => { vi.unstubAllGlobals(); });
beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const providers = (entry = "/practice?seasonId=season-1") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function TestProviders({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}>
      {children}<LocationOutput />
    </MemoryRouter></QueryClientProvider>;
  };
};

function LocationOutput() {
  const location = useLocation();
  return <output data-testid="practice-location">{location.search}</output>;
}

const pathFor = (input: RequestInfo | URL): string => {
  const value = input instanceof Request
    ? input.url
    : input instanceof URL ? input.href : input;
  return new URL(value, "http://mockd.test").pathname;
};

const requestCount = (fetcher: ReturnType<typeof vi.fn<PlatformFetch>>, path: string) =>
  fetcher.mock.calls.filter(call => pathFor(call[0]) === path).length;

describe("PracticePage", () => {
  it("opens an auction mock for the active league", async () => {
    vi.stubGlobal("fetch", createPracticeFetch());
    const view = render(<PracticePage />, { wrapper: providers() });

    expect(await screen.findByRole("link", { name: "Start mock draft" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games/mock-drafts",
    );
    view.unmount();
  });

  it("loads personalized board data and persists draft-target changes", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createPracticeFetch());
    const view = render(<PracticePage />, { wrapper: providers() });

    expect(await screen.findByRole("heading", { name: "Draft lab" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Remove Puka Nacua from simulation plan" })).toBeInTheDocument();
    expect(screen.getByText("Sunday Games · 2026")).toBeInTheDocument();
    const personalValue = screen.getByRole("spinbutton", { name: "My value for Puka Nacua" });
    await user.clear(personalValue);
    await user.type(personalValue, "80{Enter}");
    expect(await screen.findByRole("spinbutton", { name: "Maximum bid for Puka Nacua" })).toHaveValue(80);
    await user.click(screen.getByRole("combobox", { name: "My value strategy" }));
    await user.click(screen.getByRole("option", { name: "WR heavy" }));
    expect(screen.getByRole("combobox", { name: "My value strategy" })).toHaveTextContent("WR heavy");
    await user.click(screen.getByRole("combobox", { name: "Active league" }));
    await user.click(screen.getByRole("option", { name: "Baseline board" }));
    expect(await screen.findByText("Baseline values")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Active league" }));
    await user.click(screen.getByRole("option", { name: "Sunday Games · 2026" }));
    await user.click(screen.getByRole("button", { name: "Remove Puka Nacua from simulation plan" }));
    expect(await screen.findByText("Star players on the board to build this plan.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Puka Nacua to simulation plan" }));
    const maxBid = await screen.findByRole("spinbutton", { name: "Maximum bid for Puka Nacua" });
    await user.click(screen.getByRole("button", { name: "Save Puka Nacua maximum bid" }));
    await user.type(maxBid, "70");
    await user.click(screen.getByRole("button", { name: "Save Puka Nacua maximum bid" }));
    expect(await screen.findByRole("spinbutton", { name: "Maximum bid for Puka Nacua" })).toHaveValue(70);
    await user.click(screen.getByRole("button", { name: "Remove Puka Nacua" }));
    expect(await screen.findByText("Star players on the board to build this plan.")).toBeInTheDocument();
    view.unmount();
  });

  it("uses ranks, targets, and pick strategy instead of auction prices for snake leagues", async () => {
    vi.stubGlobal("fetch", createPracticeFetch({ draftFormat: "snake" }));
    const view = render(<PracticePage />, { wrapper: providers() });

    expect(await screen.findByRole("columnheader", { name: "Rank" })).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Market" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Simulation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "My value" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "My value for Puka Nacua" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Puka Nacua from simulation plan" }))
      .toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: "Maximum bid for Puka Nacua" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Draft strategy" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Optional draft strategy" }))
      .toHaveAttribute("placeholder", "Example: draft Lamar Jackson by Round 5.");

    view.unmount();
  });

  it("runs simulations and opens saved results", async () => {
    const user = userEvent.setup();
    stubPracticeSimulationWorker();
    const fetcher = vi.fn<PlatformFetch>();
    fetcher.mockImplementation(createPracticeFetch({ runCount: 2 }));
    vi.stubGlobal("fetch", fetcher);
    const view = render(<PracticePage />, { wrapper: providers() });
    await screen.findByRole("button", { name: "Remove Puka Nacua from simulation plan" });
    expect(screen.getByRole("heading", { name: "Available players" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Draft targets" })).toBeInTheDocument();
    expect(requestCount(fetcher, "/season-simulations/history-1/runs/1")).toBe(0);

    await user.click(screen.getByRole("button", { name: "Run simulations" }));
    expect(await screen.findByRole("heading", { name: "League outcomes" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Short King" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Available players" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Draft targets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run simulations" })).toBeInTheDocument();
    expect(requestCount(fetcher, "/season-simulations/history-new")).toBe(1);
    expect(requestCount(fetcher, "/season-simulations/history-new/runs/1")).toBe(1);
    await user.click(screen.getByRole("button", { name: "Save Run 1 to My Team" }));
    await user.click(screen.getByRole("button", { name: /Open 1-run simulation/u }));
    expect(await screen.findByText("Saved run", { selector: ".simulation-results__note p" })).toBeInTheDocument();
    expect(screen.getByTestId("practice-location")).toHaveTextContent("runId=history-1");
    expect(requestCount(fetcher, "/season-simulations/history-1/runs/1")).toBe(1);
    await user.click(screen.getByRole("combobox", { name: "Simulation outcome" }));
    await user.click(screen.getByRole("option", { name: "#2 Run 2 · 99.2 pts" }));
    expect(await screen.findByText("#2 Run 2 · 99.2 pts", { selector: ".practice-select__trigger span" })).toBeInTheDocument();
    expect(screen.getByTestId("practice-location")).toHaveTextContent("simulationRun=2");
    expect(requestCount(fetcher, "/season-simulations/history-1/runs/2")).toBe(1);
    await user.click(screen.getByRole("button", { name: "Exit simulations" }));
    expect(await screen.findByRole("heading", { name: "Available players" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "League outcomes" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Draft targets" })).toBeInTheDocument();
    expect(screen.getByTestId("practice-location")).not.toHaveTextContent("runId=");
    view.unmount();
  });

  it("opens the first run when an older simulation response has no outcome summaries", async () => {
    const user = userEvent.setup();
    stubPracticeSimulationWorker();
    vi.stubGlobal("fetch", createPracticeFetch({ emptyOutcomes: true }));
    const view = render(<PracticePage />, { wrapper: providers() });

    await screen.findByRole("button", { name: "Run simulations" });
    await user.click(screen.getByRole("button", { name: "Run simulations" }));

    expect(await screen.findByRole("heading", { name: "League outcomes" })).toBeInTheDocument();
    expect(screen.getByTestId("practice-location")).toHaveTextContent("simulationRun=1");
    view.unmount();
  });

  it("removes the previous league simulation when the active league changes", async () => {
    const user = userEvent.setup();
    const baseFetch = createPracticeFetch({ runCount: 2 });
    const fetcher = vi.fn<PlatformFetch>(async (input, init) => {
      if (pathFor(input) !== "/onboarding") return baseFetch(input, init);
      return new Response(JSON.stringify({
        account: { email: "user@example.com", id: "user-1" },
        leagues: [
          league(true),
          {
            ...league(true),
            leagueId: "league-2",
            leagueName: "Work League",
            seasonId: "season-2",
          },
        ],
      }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetcher);
    const entry = "/practice?seasonId=season-1&runId=history-1&simulationRun=2&strategy=wr-heavy";
    const view = render(<PracticePage />, { wrapper: providers(entry) });

    expect(await screen.findByRole("heading", { name: "League outcomes" })).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Active league" }));
    await user.click(screen.getByRole("option", { name: "Work League · 2026" }));

    expect(screen.getByTestId("practice-location")).toHaveTextContent(
      "strategy=wr-heavy",
    );
    expect(screen.queryByRole("heading", { name: "League outcomes" })).not.toBeInTheDocument();
    expect(requestCount(fetcher, "/season-simulations/history-1/runs/2")).toBe(1);
    view.unmount();
  });
});
