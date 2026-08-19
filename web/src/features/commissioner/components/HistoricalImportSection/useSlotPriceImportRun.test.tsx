import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { auctionSeason, jsonResponse, requestBody, requestPath } from "../../test/commissionerFixtures";
import { useSlotPriceImportRun } from "./useSlotPriceImportRun";

const sheet = (seasonYear: number) => ({ seasonYear, sourceText: "Slot,Price\nRB1,75" });

const previewBody = (
  status: "blocked" | "previewed",
  extras: { blockers?: readonly { code: string; message: string }[]; warnings?: readonly { code: string; message: string }[] } = {},
) => ({
  source: { sourceWarnings: extras.warnings ?? [] },
  batch: {
    id: `batch-${status}`,
    status,
    blockers: extras.blockers ?? [],
    warnings: [],
    rows: [],
  },
});

const committedBody = (count: number) => ({
  batch: { id: "batch-previewed", status: "committed" },
  committedRecords: Array.from({ length: count }, () => ({ playerName: "RB1" })),
});

const runHook = (fetcher: PlatformFetch, replace = false) => {
  vi.stubGlobal("fetch", fetcher);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => useSlotPriceImportRun({ replace, seasonId: auctionSeason.id }),
    { wrapper },
  );
  return { queryClient, view };
};

const respondWith = (preview: unknown, committedCount = 1): PlatformFetch => input =>
  Promise.resolve(requestPath(input).includes("commit")
    ? jsonResponse(committedBody(committedCount))
    : jsonResponse(preview));

describe("useSlotPriceImportRun", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("imports a year and refreshes the stored import count", async () => {
    const { queryClient, view } = runHook(vi.fn(respondWith(previewBody("previewed"), 2)));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]).toEqual({
      seasonYear: 2024,
      message: "2 slots imported.",
      status: "imported",
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: seasonQueryKeys.commissionerHistoricalImports(auctionSeason.id),
    });
    expect(view.result.current.percent).toBe(100);
  });

  it("counts a single imported slot in the singular", async () => {
    const { view } = runHook(vi.fn(respondWith(previewBody("previewed"), 1)));

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]?.message).toBe("1 slot imported.");
  });

  it("repeats a parse warning beside the imported count", async () => {
    const { view } = runHook(vi.fn(respondWith(previewBody("previewed", {
      warnings: [{ code: "invalid_position_rank", message: "Row 3 has no position rank." }],
    }))));

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]?.message)
      .toBe("1 slot imported. Row 3 has no position rank.");
  });

  it("imports each year one at a time so the rebuilds do not race", async () => {
    const seasonYears: number[] = [];
    const fetcher = vi.fn<PlatformFetch>((input, init) => {
      if (!requestPath(input).includes("commit")) {
        const body: unknown = JSON.parse(requestBody(init) || "{}");
        if (body !== null && typeof body === "object" && "seasonYear" in body) {
          seasonYears.push(Number(body.seasonYear));
        }
      }
      return Promise.resolve(requestPath(input).includes("commit")
        ? jsonResponse(committedBody(1))
        : jsonResponse(previewBody("previewed")));
    });
    const { view } = runHook(fetcher);

    view.result.current.start([sheet(2024), sheet(2023)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(2); });
    expect(seasonYears).toEqual([2024, 2023]);
  });

  it("reports a blocked year without refreshing the stored import count", async () => {
    const { queryClient, view } = runHook(vi.fn(respondWith(previewBody("blocked", {
      blockers: [
        { code: "position_invalid", message: "Position must be QB, RB, WR, TE, K, or DST." },
        { code: "position_invalid", message: "Position must be QB, RB, WR, TE, K, or DST." },
      ],
    }))));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]).toEqual({
      seasonYear: 2024,
      message: "Position must be QB, RB, WR, TE, K, or DST.",
      status: "error",
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("adds a parse warning to the reasons a year was blocked", async () => {
    const { view } = runHook(vi.fn(respondWith(previewBody("blocked", {
      blockers: [{ code: "player_missing", message: "Player name is required." }],
      warnings: [{ code: "invalid_position_rank", message: "Row 3 has no position rank." }],
    }))));

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]?.message)
      .toBe("Player name is required. Row 3 has no position rank.");
  });

  it("imports a year from a preview that reported no parse warnings at all", async () => {
    const { view } = runHook(vi.fn(respondWith({
      source: {},
      batch: { id: "batch-previewed", status: "previewed", blockers: [], warnings: [], rows: [] },
    })));

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]?.message).toBe("1 slot imported.");
  });

  it("says something useful when a year is blocked for no stated reason", async () => {
    const { view } = runHook(vi.fn(respondWith(previewBody("blocked"))));

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]?.message).toBe("This sheet could not be imported.");
  });

  it("reports a failed request against the year that failed", async () => {
    const { view } = runHook(vi.fn(() => Promise.resolve(
      jsonResponse({ error: { code: "historical_import_locked", message: "History is locked." } }, 409),
    )));

    view.result.current.start([sheet(2024)]);

    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });
    expect(view.result.current.outcomes[0]).toMatchObject({ seasonYear: 2024, status: "error" });
  });

  it("holds progress at zero until a year starts and clears on reset", async () => {
    const { view } = runHook(vi.fn(respondWith(previewBody("previewed"))), true);

    expect(view.result.current.percent).toBe(0);
    view.result.current.start([sheet(2024)]);
    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(1); });

    view.result.current.reset();
    await waitFor(() => { expect(view.result.current.outcomes).toHaveLength(0); });
    expect(view.result.current.percent).toBe(0);
  });
});
