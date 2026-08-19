import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { providerCatalogFixture } from "../../api/leagueConnections.fixture";
import { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { AddConnection } from "./AddConnection";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("AddConnection", () => {
  it("asks for a provider before asking for anything else", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const { result } = renderHook(() => useLeagueConnectionMutations(), { wrapper });

    render(<QueryClientProvider client={new QueryClient()}>
      <AddConnection mutations={result.current} providers={providerCatalogFixture} />
    </QueryClientProvider>);

    expect(screen.getByRole("heading", { name: "Connect a league" })).toBeVisible();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Find leagues" })).not.toBeInTheDocument();
  });
});
