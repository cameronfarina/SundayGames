import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectionListFixture,
  needsAttentionConnectionFixture,
  providerCatalogFixture,
  syncedConnectionFixture,
} from "../../../leagueConnections/api/leagueConnections.fixture";
import type { LeagueConnection } from "../../../leagueConnections/api/leagueConnectionsSchema";
import { ConnectedLeaguesCard } from "./ConnectedLeaguesCard";

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);

const listOf = (...connections: readonly LeagueConnection[]) => jsonResponse({
  connections,
  providers: providerCatalogFixture,
});

const renderCard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConnectedLeaguesCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConnectedLeaguesCard", () => {
  it("counts what is connected, synced, and waiting on the owner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(connectionListFixture)));
    renderCard();

    expect(await screen.findByText("2 leagues")).toBeVisible();
    expect(screen.getAllByText("1 league")).toHaveLength(2);
    expect(screen.getByText(/what each one is waiting on/u)).toBeVisible();
  });

  it("leaves out the prompt when nothing is waiting on the owner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listOf(syncedConnectionFixture)));
    renderCard();

    expect(await screen.findAllByText("1 league")).toHaveLength(2);
    expect(screen.queryByText(/what each one is waiting on/u)).not.toBeInTheDocument();
  });

  // Counting it only in the total keeps it visible without telling the owner to
  // re-authenticate something they cannot fix.
  it("shows a provider-side failure without asking the owner to sign in again", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      listOf({ ...syncedConnectionFixture, status: "error" }),
    ));
    renderCard();

    expect(await screen.findByText("1 league")).toBeVisible();
    expect(screen.getAllByText("0 leagues")).toHaveLength(2);
    expect(screen.queryByText(/what each one is waiting on/u)).not.toBeInTheDocument();
  });

  it("counts an account with no connections at zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listOf()));
    renderCard();

    expect(await screen.findAllByText("0 leagues")).toHaveLength(3);
  });

  it("waits without a number while the connections load", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => undefined)));
    renderCard();

    expect(screen.getByRole("status")).toHaveTextContent("Counting your leagues...");
  });

  it("still offers the way through when the connections cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "server_error", message: "Nope." },
    }, 503)));
    renderCard();

    expect(await screen.findByText(/could not read your league connections/u)).toBeVisible();
    expect(screen.getByRole("link", { name: "Manage connections" }))
      .toHaveAttribute("href", "/connections");
  });

  it("names the league that needs attention only on the connections page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listOf(needsAttentionConnectionFixture)));
    renderCard();

    expect(await screen.findByText(/what each one is waiting on/u)).toBeVisible();
    expect(screen.queryByText(needsAttentionConnectionFixture.displayName)).not.toBeInTheDocument();
  });
});
