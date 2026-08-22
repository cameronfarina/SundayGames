import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  discoveredLeaguesFixture,
  importedConnectionFixture,
  leagueImportFixture,
  syncedConnectionFixture,
} from "../api/leagueConnections.fixture";
import type { DiscoveredLeague, LeagueConnection } from "../api/leagueConnectionsSchema";
import { discoveredLeagueKey } from "../lib/discoveredLeagueState";
import { useDiscoveredImports } from "./useDiscoveredImports";
import { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const leagues: readonly DiscoveredLeague[] = discoveredLeaguesFixture.leagues;
const firstLeague = leagues[0] ?? { providerLeagueId: "", name: "", season: "", teamCount: 0 };

const pathOf = (target: RequestInfo | URL): string => {
  if (typeof target === "string") return target;
  return target instanceof URL ? target.href : target.url;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const importsFine = (path: string): Response => jsonResponse(
  path.endsWith("/import") ? leagueImportFixture : { connection: syncedConnectionFixture },
);

interface RenderOptions {
  readonly connections?: readonly LeagueConnection[];
  readonly credentials?: { readonly espnS2?: string };
  readonly leagues?: readonly DiscoveredLeague[];
  readonly provider?: "espn" | "sleeper" | undefined;
}

const renderImports = (
  respond: (path: string) => Response | Promise<Response>,
  options: RenderOptions = {},
) => {
  const connections = options.connections ?? [];
  const credentials = options.credentials ?? { espnS2: "s2-value" };
  const discovered = options.leagues ?? leagues;
  // Deliberately not a default: "no provider chosen yet" is one of the cases.
  const provider = "provider" in options ? options.provider : "sleeper";
  const paths: string[] = [];
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (target: RequestInfo | URL, init?: RequestInit) => {
    const path = pathOf(target);
    paths.push(path);
    if (init?.body !== undefined && typeof init.body === "string") {
      bodies.push(JSON.parse(init.body));
    }
    return await respond(path);
  }));
  const onImported = vi.fn();
  const { result } = renderHook(() => {
    const mutations = useLeagueConnectionMutations();
    return useDiscoveredImports({
      connections,
      credentials,
      leagues: discovered,
      mutations,
      onImported,
      provider,
    });
  }, { wrapper });
  return { bodies, onImported, paths, result };
};

const stateOf = (
  states: Record<string, { readonly status: string }>,
  league: DiscoveredLeague,
) => states[discoveredLeagueKey(league)];

describe("useDiscoveredImports", () => {
  it("saves the connection and then builds the Sunday Games league from it", async () => {
    const { onImported, paths, result } = renderImports(importsFine);

    act(() => { result.current.importLeague(firstLeague); });

    await waitFor(() => { expect(onImported).toHaveBeenCalledOnce(); });
    expect(paths).toEqual([
      "/league-connections",
      "/league-connections/connection-sleeper/import",
    ]);
    expect(stateOf(result.current.states, firstLeague)).toEqual({
      leagueSlug: "sleeper-friends-league",
      status: "imported",
    });
  });

  it("retries an unresolved provider draft with the chosen draft settings", async () => {
    const { bodies, onImported, result } = renderImports(importsFine);

    act(() => {
      result.current.importLeague(firstLeague, {
        type: "auction",
        budgetDollars: 250,
        minimumBidDollars: 2,
      });
    });

    await waitFor(() => { expect(onImported).toHaveBeenCalledOnce(); });
    expect(bodies[1]).toEqual({
      draft: { type: "auction", budgetDollars: 250, minimumBidDollars: 2 },
      mode: "create",
    });
  });

  it("retains support for importing a publicly viewable ESPN discovery", async () => {
    const { bodies, onImported, result } = renderImports(importsFine, {
      credentials: {},
      provider: "espn",
    });

    act(() => { result.current.importLeague(firstLeague); });

    await waitFor(() => { expect(onImported).toHaveBeenCalledOnce(); });
    expect(bodies[0]).toMatchObject({ credentialMode: "public", provider: "espn" });
  });

  it("keeps every reason a refused import gave next to that league", async () => {
    const { onImported, result } = renderImports(path => path.endsWith("/import")
      ? jsonResponse({
        error: {
          code: "import_needs_review",
          message: "This league needs a look first.",
          issues: ["ESPN roster slot HC is not supported."],
        },
      }, 422)
      : jsonResponse({ connection: syncedConnectionFixture }));

    act(() => { result.current.importLeague(firstLeague); });

    await waitFor(() => {
      expect(stateOf(result.current.states, firstLeague)?.status).toBe("error");
    });
    expect(stateOf(result.current.states, firstLeague)).toEqual({
      issues: ["ESPN roster slot HC is not supported."],
      message: "This league needs a look first.",
      status: "error",
    });
    expect(onImported).not.toHaveBeenCalled();
  });

  it("imports all eight discovered leagues one after another", async () => {
    const accountLeagues = Array.from({ length: 8 }, (_, index) => ({
      providerLeagueId: String(900_001 + index),
      name: `ESPN League ${String(index + 1)}`,
      season: "2026",
      teamCount: 12,
    }));
    const { onImported, paths, result } = renderImports(importsFine, {
      leagues: accountLeagues,
    });

    act(() => { result.current.importAll(); });

    await waitFor(() => { expect(paths).toHaveLength(16); });
    expect(onImported).toHaveBeenCalledOnce();
    expect(Object.values(result.current.states).map(state => state.status))
      .toEqual(Array.from({ length: 8 }, () => "imported"));
  });

  it("carries on through a failure and reports nothing as imported", async () => {
    const { onImported, paths, result } = renderImports(path => path.endsWith("/import")
      ? jsonResponse({
        error: { code: "snapshot_required", message: "Sync this league before importing it." },
      }, 409)
      : jsonResponse({ connection: syncedConnectionFixture }));

    act(() => { result.current.importAll(); });

    await waitFor(() => { expect(paths).toHaveLength(4); });
    expect(Object.values(result.current.states).map(state => state.status))
      .toEqual(["error", "error"]);
    expect(onImported).not.toHaveBeenCalled();
  });

  it("leaves a league that was already imported alone", async () => {
    const { paths, result } = renderImports(importsFine, {
      connections: [importedConnectionFixture],
    });

    act(() => { result.current.importAll(); });

    await waitFor(() => { expect(paths).toHaveLength(2); });
    expect(stateOf(result.current.states, firstLeague)?.status).toBe("imported");
  });

  it("says an import is running while the provider is still answering", async () => {
    const { result } = renderImports(() => new Promise<Response>(() => undefined));

    act(() => { result.current.importLeague(firstLeague); });

    await waitFor(() => { expect(result.current.running).toBe(true); });
    expect(stateOf(result.current.states, firstLeague)?.status).toBe("connecting");
  });

  it("does nothing at all until a provider is chosen", () => {
    const { onImported, paths, result } = renderImports(importsFine, { provider: undefined });

    act(() => { result.current.importLeague(firstLeague); });

    expect(paths).toEqual([]);
    expect(onImported).not.toHaveBeenCalled();
  });

  it("forgets earlier attempts when a fresh search replaces the results", async () => {
    const { result } = renderImports(importsFine);

    act(() => { result.current.importLeague(firstLeague); });
    await waitFor(() => {
      expect(stateOf(result.current.states, firstLeague)?.status).toBe("imported");
    });
    act(() => { result.current.reset(); });

    expect(stateOf(result.current.states, firstLeague)).toEqual({ status: "idle" });
  });
});
