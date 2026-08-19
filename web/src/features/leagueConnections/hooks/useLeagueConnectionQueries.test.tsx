import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { connectionListFixture } from "../api/leagueConnections.fixture";
import { connectionDetailFixture } from "../api/leagueDetail.fixture";
import {
  leagueConnectionQueryKeys,
  useLeagueConnectionDetailQuery,
  useLeagueConnectionsQuery,
} from "./useLeagueConnectionQueries";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("league connection queries", () => {
  it("keys the list and each league detail apart", () => {
    expect(leagueConnectionQueryKeys.list()).toEqual(["league-connections", "list"]);
    expect(leagueConnectionQueryKeys.detail("connection-1"))
      .toEqual(["league-connections", "detail", "connection-1"]);
  });

  it("loads the connection list", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
      new Response(JSON.stringify(connectionListFixture)),
    )));

    const { result } = renderHook(() => useLeagueConnectionsQuery(), { wrapper });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.connections).toHaveLength(2);
  });

  it("loads one league's detail and stays idle without a connection", async () => {
    const fetcher = vi.fn(() => Promise.resolve(
      new Response(JSON.stringify(connectionDetailFixture)),
    ));
    vi.stubGlobal("fetch", fetcher);

    const { result: idle } = renderHook(
      () => useLeagueConnectionDetailQuery(undefined),
      { wrapper },
    );
    expect(idle.current.fetchStatus).toBe("idle");

    const { result: active } = renderHook(
      () => useLeagueConnectionDetailQuery("connection-sleeper"),
      { wrapper },
    );
    await waitFor(() => { expect(active.current.isSuccess).toBe(true); });
    expect(active.current.data?.league?.teams).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
