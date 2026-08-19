import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import {
  comradesLeagueFixture,
  discoveredLeaguesFixture,
  providerCatalogFixture,
  syncedConnectionFixture,
} from "../api/leagueConnections.fixture";
import { asksForCookies, currentLeagueSeason, useAddConnectionForm } from "./useAddConnectionForm";
import { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

type StubResponse = (path: string) => Response;

const pathOf = (target: RequestInfo | URL): string => {
  if (typeof target === "string") return target;
  return target instanceof URL ? target.href : target.url;
};

const renderForm = (respond: StubResponse) => {
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

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const alwaysDiscovers = (): Response => jsonResponse(discoveredLeaguesFixture);

const espnLeagueOnly = {
  provider: "espn",
  season: "2026",
  leagues: [{
    providerLeagueId: "899513",
    name: "Pigskin Power Bottoms",
    season: "2026",
    teamCount: 12,
  }],
};

describe("useAddConnectionForm", () => {
  it("does nothing until a provider and a handle are both present", () => {
    const { fetcher, result } = renderForm(alwaysDiscovers);

    act(() => { result.current.findLeagues(); });
    act(() => { result.current.selectProvider("sleeper"); });
    act(() => { result.current.findLeagues(); });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.chosen?.label).toBe("Sleeper");
  });

  it("sends the current season with the lookup and keeps several leagues to choose from", async () => {
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

  it("connects a one-league provider without a second step", async () => {
    const paths: string[] = [];
    const { result } = renderForm(path => {
      paths.push(path);
      return jsonResponse(path.endsWith("/discover")
        ? espnLeagueOnly
        : { connection: syncedConnectionFixture });
    });

    act(() => { result.current.selectProvider("espn"); });
    act(() => { result.current.setHandle("899513"); });
    act(() => { result.current.findLeagues(); });

    await waitFor(() => { expect(paths).toHaveLength(2); });
    expect(paths[1]).toBe("/league-connections");
    // Nothing to pick from, so the owner is never shown a one-item list.
    expect(result.current.leagues).toEqual([]);
    await waitFor(() => { expect(result.current.handle).toBe(""); });
  });

  it("reveals the cookie step only when the provider refuses for want of credentials", async () => {
    const { result } = renderForm(() => jsonResponse(
      { error: { code: "credentials_required", message: "This league is private." } },
      422,
    ));

    act(() => { result.current.selectProvider("espn"); });
    act(() => { result.current.setHandle("1"); });
    act(() => { result.current.findLeagues(); });

    await waitFor(() => { expect(result.current.showCookieStep).toBe(true); });
  });

  it("leaves the cookie step hidden for a failure cookies cannot fix", async () => {
    const { result } = renderForm(() => jsonResponse(
      { error: { code: "league_not_found", message: "No such league." } },
      404,
    ));

    act(() => { result.current.selectProvider("espn"); });
    act(() => { result.current.setHandle("12345"); });
    act(() => { result.current.findLeagues(); });

    await waitFor(() => { expect(result.current.chosen?.provider).toBe("espn"); });
    expect(result.current.showCookieStep).toBe(false);
  });

  it("carries trimmed cookies into the lookup", async () => {
    const { fetcher, result } = renderForm(alwaysDiscovers);

    act(() => { result.current.selectProvider("sleeper"); });
    act(() => {
      result.current.setHandle("feiyingx");
      result.current.setEspnS2(" s2-value ");
      result.current.setSwid(" {GUID} ");
    });
    act(() => { result.current.findLeagues(); });

    await waitFor(() => { expect(result.current.leagues).toHaveLength(2); });
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain("\"espnS2\":\"s2-value\"");
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain("\"swid\":\"{GUID}\"");
  });

  it("clears the typed handle and cookies once a league is connected", async () => {
    const { result } = renderForm(() => jsonResponse({ connection: syncedConnectionFixture }));

    act(() => { result.current.selectProvider("sleeper"); });
    act(() => {
      result.current.setHandle("feiyingx");
      result.current.setEspnS2("s2-value");
    });
    act(() => { result.current.connect(comradesLeagueFixture); });

    await waitFor(() => { expect(result.current.handle).toBe(""); });
    expect(result.current.espnS2).toBe("");
    expect(result.current.swid).toBe("");
  });

  it("ignores a connect before a provider is chosen", () => {
    const { fetcher, result } = renderForm(alwaysDiscovers);

    act(() => { result.current.connect(comradesLeagueFixture); });

    expect(fetcher).not.toHaveBeenCalled();
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
  });
});

describe("asksForCookies", () => {
  it("recognises only the two refusals a pasted cookie can fix", () => {
    const platformError = (code: string) =>
      new PlatformApiError({ code, message: "nope", status: 422 });

    expect(asksForCookies(platformError("credentials_required"))).toBe(true);
    expect(asksForCookies(platformError("credentials_rejected"))).toBe(true);
    expect(asksForCookies(platformError("league_not_found"))).toBe(false);
    expect(asksForCookies(new Error("boom"))).toBe(false);
  });
});
