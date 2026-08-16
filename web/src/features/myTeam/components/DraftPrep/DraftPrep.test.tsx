import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DraftPrep } from "./DraftPrep";

const target = {
  createdAt: "2026-08-16T12:00:00.000Z",
  id: "target-1",
  leagueId: "league-1",
  maxBid: 25,
  playerName: "Ladd McConkey",
  position: "WR",
  priority: 1,
  seasonId: "season-2026",
  updatedAt: "2026-08-16T12:00:00.000Z",
  userId: "user-1",
};

const simulation = {
  completedCount: 25,
  draftFormat: "auction",
  outcomes: [{ favorite: true, rank: 1, runNumber: 7, userWeek1Points: 119.8 }],
  runCount: 25,
  strategy: { preferredPositions: [], rawInput: "", summary: "Balanced", warnings: [] },
};

const renderPrep = (fetcher: typeof fetch) => {
  vi.stubGlobal("fetch", fetcher);
  const view = <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><DraftPrep seasonId="season-2026" /></MemoryRouter>
  </QueryClientProvider>;
  return render(view);
};

const requestUrl = (input: RequestInfo | URL): string => input instanceof Request
  ? input.url
  : input instanceof URL ? input.href : input;

const prepFetch = (planBody: unknown, historyBody: unknown, planStatus = 200, historyStatus = 200) =>
  vi.fn((input: RequestInfo | URL) => Promise.resolve(requestUrl(input).startsWith("/practice-shortlist")
    ? new Response(JSON.stringify(planBody), { status: planStatus })
    : new Response(JSON.stringify(historyBody), { status: historyStatus })));

describe("DraftPrep", () => {
  it("shows the active plan, favorite outcomes, and ranked run history", async () => {
    renderPrep(prepFetch(
      { items: [target, { ...target, id: "target-2", maxBid: undefined, playerName: "Jared Goff", position: "QB", priority: 2 }] },
      { history: [{ id: "history-1", note: "High ceiling", simulation }] },
    ));
    expect(await screen.findByText("Ladd McConkey")).toBeVisible();
    expect(screen.getByText(/No max bid/u)).toBeVisible();
    expect(screen.getByText("Run 7 · 119.8 projected Week 1 points")).toBeVisible();
    expect(screen.getByText("25 drafts · Best 119.8 points")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Open" })[0]).toHaveAttribute(
      "href",
      "/practice?seasonId=season-2026&runId=history-1&simulationRun=7",
    );
  });

  it("explains empty prep without inventing saved data", async () => {
    renderPrep(prepFetch({ items: [] }, { history: [] }));
    expect(await screen.findByText("No targets yet. Add players from the Practice board to build a plan.")).toBeVisible();
    expect(screen.getByText("Favorite a result in Practice to keep the roster here.")).toBeVisible();
    expect(screen.getByText("No simulation history yet.")).toBeVisible();
  });

  it("reports plan and history failures", async () => {
    const failing = prepFetch(
      { error: { code: "plan_failed", message: "Plan unavailable." } },
      { history: [] },
      503,
    );
    const { unmount } = renderPrep(failing);
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan unavailable.");
    unmount();
    renderPrep(prepFetch(
      { items: [] },
      { error: { code: "history_failed", message: "History unavailable." } },
      200,
      503,
    ));
    expect(await screen.findByRole("alert")).toHaveTextContent("History unavailable.");
  });

  it("uses strategy summaries and Run 1 for legacy history", async () => {
    renderPrep(prepFetch(
      { items: [] },
      { history: [{ id: "legacy", simulation: { ...simulation, outcomes: [] } }] },
    ));
    expect(await screen.findByText("Balanced")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/practice?seasonId=season-2026&runId=legacy&simulationRun=1",
    );
  });
});
