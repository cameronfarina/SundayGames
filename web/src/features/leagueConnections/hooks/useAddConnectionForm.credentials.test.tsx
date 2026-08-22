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

const renderForm = () => {
  const fetcher = vi.fn((target: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const path = typeof target === "string" ? target : target instanceof URL ? target.href : target.url;
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

  it("uses complete credentials to discover only the ESPN league entered", async () => {
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
      handle: "899513",
      season: currentLeagueSeason,
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    }));
  });

  it("does not search with credentials until an ESPN league is entered", () => {
    const { fetcher, result } = renderForm();
    act(() => { result.current.selectProvider("espn"); });

    act(() => { result.current.findLeaguesWithCredentials({
      espnS2: "account-s2",
      swid: "{ACCOUNT}",
    }); });

    expect(fetcher).not.toHaveBeenCalled();
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
      handle: "899513",
      season: currentLeagueSeason,
      ...expected,
    });
  });
});
