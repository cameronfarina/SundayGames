import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  discoveredLeaguesFixture,
  leagueImportFixture,
  syncedConnectionFixture,
} from "../api/leagueConnections.fixture";
import { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const respondWith = (body: unknown) => {
  const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body))));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

describe("league connection mutations", () => {
  it("looks up leagues without touching the cached connection list", async () => {
    respondWith(discoveredLeaguesFixture);
    const { result } = renderHook(() => useLeagueConnectionMutations(), { wrapper });

    result.current.discover.mutate({ provider: "sleeper", handle: "feiyingx", season: "2026" });

    await waitFor(() => { expect(result.current.discover.isSuccess).toBe(true); });
    expect(result.current.discover.data?.leagues).toHaveLength(2);
  });

  it("refreshes the list after connecting, syncing, or disconnecting", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    respondWith({ connection: syncedConnectionFixture });
    const { result } = renderHook(() => useLeagueConnectionMutations(), { wrapper });

    result.current.connect.mutate({
      provider: "sleeper",
      providerLeagueId: "289646328504385536",
      displayName: "Sleeper Friends League",
      season: "2026",
    });
    await waitFor(() => { expect(result.current.connect.isSuccess).toBe(true); });

    result.current.sync.mutate("connection-sleeper");
    await waitFor(() => { expect(result.current.sync.isSuccess).toBe(true); });

    respondWith({ removed: true });
    result.current.remove.mutate("connection-sleeper");
    await waitFor(() => { expect(result.current.remove.isSuccess).toBe(true); });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["league-connections", "detail", "connection-sleeper"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["league-connections", "list"] });
  });

  it("refreshes onboarding after an import so the header picker sees the new league", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    respondWith(leagueImportFixture);
    const { result } = renderHook(() => useLeagueConnectionMutations(), { wrapper });

    result.current.importLeague.mutate({
      connectionId: "connection-sleeper",
      request: { mode: "create" },
    });

    await waitFor(() => { expect(result.current.importLeague.isSuccess).toBe(true); });
    expect(result.current.importLeague.data?.imported.leagueSlug).toBe("sleeper-friends-league");
    expect(invalidate).toHaveBeenCalledWith({ exact: true, queryKey: ["onboarding"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["league-connections", "detail", "connection-sleeper"],
    });
  });
});
