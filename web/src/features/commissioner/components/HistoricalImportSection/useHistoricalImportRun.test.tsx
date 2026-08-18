import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import type { HistoricalQueueAction } from "../../model/historicalFileQueue";
import { auctionSeason, jsonResponse, requestPath } from "../../test/commissionerFixtures";
import { useHistoricalImportRun, type ImportableFile } from "./useHistoricalImportRun";

const fileFor = (name: string): ImportableFile => ({
  item: {
    file: new File(["draft"], name, { type: "text/csv" }),
    id: name,
    message: "",
    ownerMappings: {},
    ownerNeeds: [],
    seasonYear: "2024",
    status: "ready",
  },
  seasonYear: 2024,
});

const previewBody = (status: "blocked" | "previewed") => ({
  source: {},
  batch: { id: "batch-1", status, blockers: [{ code: "bad_sheet", message: "Columns are missing." }], warnings: [], rows: [] },
});

const runHook = (fetcher: PlatformFetch, dispatch: (action: HistoricalQueueAction) => void) => {
  vi.stubGlobal("fetch", fetcher);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => useHistoricalImportRun({ dispatch, keepersInFirstRow: false, replace: false, season: auctionSeason }),
    { wrapper },
  );
  return { queryClient, view };
};

describe("useHistoricalImportRun", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("reports a committed file and refreshes the stored import count", async () => {
    const dispatch = vi.fn();
    const respond: PlatformFetch = input => Promise.resolve(requestPath(input).includes("commit")
      ? jsonResponse({ batch: { id: "batch-1", status: "committed" }, committedRecords: [{ playerName: "Puka Nacua" }] })
      : jsonResponse(previewBody("previewed")));
    const { queryClient, view } = runHook(vi.fn(respond), dispatch);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    view.result.current.start([fileFor("draft-2024.csv")], 1);

    await waitFor(() => { expect(dispatch).toHaveBeenCalled(); });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      id: "draft-2024.csv", message: "1 players imported", status: "imported", type: "result",
    }));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: seasonQueryKeys.commissionerHistoricalImports(auctionSeason.id),
    });
    expect(view.result.current.percent).toBe(100);
  });

  it("reports a blocked preview without refreshing the stored import count", async () => {
    const dispatch = vi.fn();
    const { queryClient, view } = runHook(
      vi.fn(() => Promise.resolve(jsonResponse(previewBody("blocked")))),
      dispatch,
    );
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    view.result.current.start([fileFor("draft-2024.csv")], 1);

    await waitFor(() => { expect(dispatch).toHaveBeenCalled(); });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      message: "Columns are missing.", status: "error",
    }));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("reports the upload failure when the preview request fails", async () => {
    const dispatch = vi.fn();
    const { view } = runHook(
      vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "bad_sheet", message: "Columns are missing." } }, 422))),
      dispatch,
    );

    view.result.current.start([fileFor("draft-2024.csv")], 1);

    await waitFor(() => { expect(dispatch).toHaveBeenCalled(); });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
  });

  it("holds progress at zero before any file starts", () => {
    const { view } = runHook(vi.fn(() => Promise.resolve(jsonResponse(previewBody("previewed")))), vi.fn());

    expect(view.result.current.percent).toBe(0);
    expect(view.result.current.progress).toEqual({ completed: 0, total: 0 });
  });
});
