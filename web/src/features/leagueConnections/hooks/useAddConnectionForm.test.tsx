import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  discoveredLeaguesFixture,
  providerCatalogFixture,
} from "../api/leagueConnections.fixture";
import { currentLeagueSeason, useAddConnectionForm } from "./useAddConnectionForm";
import { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const pathOf = (target: RequestInfo | URL): string => {
  if (typeof target === "string") return target;
  return target instanceof URL ? target.href : target.url;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const renderForm = (respond: (path: string) => Response) => {
  const fetcher = vi.fn((target: RequestInfo | URL, init?: RequestInit) => {
    void init;
    return Promise.resolve(respond(pathOf(target)));
  });
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => {
    const mutations = useLeagueConnectionMutations();
    return useAddConnectionForm(providerCatalogFixture, mutations);
  }, { wrapper });
  return { fetcher, result };
};

const alwaysDiscovers = (): Response => jsonResponse(discoveredLeaguesFixture);

describe("useAddConnectionForm", () => {
  it("does nothing until a provider and a handle are both present", () => {
    const { fetcher, result } = renderForm(alwaysDiscovers);

    act(() => { result.current.setHandle("feiyingx"); });
    act(() => { result.current.findLeagues(); });
    act(() => { result.current.selectProvider("sleeper"); });
    act(() => { result.current.findLeagues(); });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.chosen?.label).toBe("Sleeper");
  });

  it("sends the current season with the lookup and keeps every league it found", async () => {
    const { fetcher, result } = renderForm(alwaysDiscovers);

    act(() => { result.current.selectProvider("sleeper"); });
    act(() => { result.current.setHandle(" feiyingx "); });
    act(() => { result.current.findLeagues(); });

    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      provider: "sleeper",
      handle: "feiyingx",
      season: currentLeagueSeason,
    }));
  });

  it("drops earlier results when the owner switches provider", async () => {
    const { result } = renderForm(alwaysDiscovers);

    act(() => { result.current.selectProvider("sleeper"); });
    act(() => { result.current.setHandle("feiyingx"); });
    act(() => { result.current.findLeagues(); });
    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });

    act(() => { result.current.selectProvider("espn"); });

    expect(result.current.leagues).toEqual([]);
    expect(result.current.provider).toBe("espn");
    expect(result.current.handle).toBe("");
  });

  it("reports nothing as importing before anything has been asked for", () => {
    const { result } = renderForm(alwaysDiscovers);

    expect(result.current.importing).toBe(false);
    expect(result.current.leagueStates).toEqual({});
  });
});
