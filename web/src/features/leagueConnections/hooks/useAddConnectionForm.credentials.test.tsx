import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  discoveredLeaguesFixture,
  leagueImportFixture,
  providerCatalogFixture,
  syncedConnectionFixture,
} from "../api/leagueConnections.fixture";
import { currentLeagueSeason, useAddConnectionForm } from "./useAddConnectionForm";
import { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const renderForm = (
  respond?: (path: string, callIndex: number) => Response,
) => {
  const fetcher = vi.fn((target: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const path = typeof target === "string" ? target : target instanceof URL ? target.href : target.url;
    if (respond !== undefined) return Promise.resolve(respond(path, fetcher.mock.calls.length));
    let body: unknown = { connection: syncedConnectionFixture };
    if (path.endsWith("/discover")) body = discoveredLeaguesFixture;
    if (path.endsWith("/import")) body = leagueImportFixture;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => {
    const mutations = useLeagueConnectionMutations();
    return useAddConnectionForm(providerCatalogFixture, mutations);
  }, { wrapper });
  return { fetcher, result };
};

describe("useAddConnectionForm credentials", () => {
  it("never sends typed cookies through the public discovery and import path", async () => {
    const { fetcher, result } = renderForm();
    act(() => { result.current.selectProvider("sleeper"); });
    act(() => {
      result.current.setHandle("feiyingx");
      result.current.setEspnS2("s2-value");
      result.current.setSwid("{GUID}");
    });
    act(() => { result.current.findLeagues(); });
    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      provider: "sleeper",
      handle: "feiyingx",
      season: currentLeagueSeason,
    }));

    const league = result.current.leagues[0];
    if (league === undefined) throw new Error("Expected a discovered league.");
    act(() => { result.current.importLeague(league); });
    await waitFor(() => { expect(result.current.handle).toBe(""); });
    expect(fetcher.mock.calls[1]?.[1]?.body).not.toContain("s2-value");
    expect(result.current.espnS2).toBe("");
    expect(result.current.swid).toBe("");
  });

  it("imports with the credential snapshot used for private discovery", async () => {
    const { fetcher, result } = renderForm();
    act(() => { result.current.selectProvider("espn"); });
    act(() => {
      result.current.setHandle("899513");
      result.current.setEspnS2("original-s2");
      result.current.setSwid("{ORIGINAL}");
    });
    act(() => { result.current.findLeaguesWithCredentials(); });
    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });
    act(() => {
      result.current.setEspnS2("edited-s2");
      result.current.setSwid("{EDITED}");
    });

    const league = result.current.leagues[0];
    if (league === undefined) throw new Error("Expected a discovered league.");
    act(() => { result.current.importLeague(league); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(3); });
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"espnS2":"original-s2"');
    expect(fetcher.mock.calls[1]?.[1]?.body).toContain('"espnS2":"original-s2"');
    expect(fetcher.mock.calls[1]?.[1]?.body).not.toContain("edited-s2");
  });

  it("keeps discovery credentials for a league that needs a later draft-format choice", async () => {
    const { fetcher, result } = renderForm((path, callIndex) => {
      if (path.endsWith("/discover")) {
        return new Response(JSON.stringify(discoveredLeaguesFixture), { status: 200 });
      }
      if (path.endsWith("/import") && callIndex === 5) {
        return new Response(JSON.stringify({
          error: { code: "import_needs_review", message: "Choose Auction or Snake." },
        }), { status: 422 });
      }
      if (path.endsWith("/import")) {
        return new Response(JSON.stringify(leagueImportFixture), { status: 200 });
      }
      return new Response(JSON.stringify({ connection: syncedConnectionFixture }), { status: 200 });
    });
    act(() => { result.current.selectProvider("espn"); });
    act(() => { result.current.findLeaguesWithCredentials({
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    }); });
    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });

    act(() => { result.current.importAll(); });
    await waitFor(() => {
      expect(Object.values(result.current.leagueStates).map(state => state.status))
        .toEqual(["imported", "error"]);
    });

    const deferredLeague = result.current.leagues[1];
    if (deferredLeague === undefined) throw new Error("Expected a deferred league.");
    act(() => { result.current.importLeague(deferredLeague, {
      type: "auction",
      budgetDollars: 200,
      minimumBidDollars: 1,
    }); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(7); });
    expect(fetcher.mock.calls[5]?.[1]?.body).toContain('"espnS2":"account-s2"');
    expect(fetcher.mock.calls[5]?.[1]?.body).toContain('"swid":"{ACCOUNT}"');
  });

  it("uses complete credentials to discover every ESPN league on the account", async () => {
    const { fetcher, result } = renderForm();
    act(() => { result.current.selectProvider("espn"); });
    act(() => {
      result.current.setHandle("899513");
      result.current.setEspnS2(" account-s2 ");
      result.current.setSwid(" {ACCOUNT} ");
    });
    act(() => { result.current.findLeaguesWithCredentials(); });
    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      provider: "espn",
      handle: "",
      season: currentLeagueSeason,
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    }));
  });

  it("can discover an ESPN account without a league id", async () => {
    const { fetcher, result } = renderForm();
    act(() => { result.current.selectProvider("espn"); });

    act(() => { result.current.findLeaguesWithCredentials({
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    }); });

    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      provider: "espn",
      handle: "",
      season: currentLeagueSeason,
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    }));
  });

  it.each([
    { espnS2: " ", expected: { swid: "{ACCOUNT}" }, swid: " {ACCOUNT} " },
    { espnS2: " account-s2 ", expected: { espnS2: "account-s2" }, swid: " " },
  ])("omits an incomplete ESPN cookie from private discovery", async ({ espnS2, expected, swid }) => {
    const { fetcher, result } = renderForm();
    act(() => { result.current.selectProvider("espn"); });
    act(() => {
      result.current.setHandle("899513");
      result.current.setEspnS2(espnS2);
      result.current.setSwid(swid);
    });
    act(() => { result.current.findLeaguesWithCredentials(); });
    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });
    const body = fetcher.mock.calls[0]?.[1]?.body;
    if (typeof body !== "string") throw new Error("Expected a JSON request body.");
    expect(JSON.parse(body)).toEqual({
      provider: "espn",
      handle: "",
      season: currentLeagueSeason,
      ...expected,
    });
  });
});
