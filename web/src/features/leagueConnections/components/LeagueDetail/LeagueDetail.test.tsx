import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { connectionListFixture } from "../../api/leagueConnections.fixture";
import { connectionDetailFixture } from "../../api/leagueDetail.fixture";
import { LeagueDetail } from "./LeagueDetail";

const renderDetail = (fetcher: typeof fetch) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>
    <LeagueDetail connectionId="connection-sleeper" />
  </QueryClientProvider>);
};

describe("LeagueDetail", () => {
  it("says it is loading before the league arrives", () => {
    renderDetail(vi.fn(() => new Promise<Response>(() => undefined)));

    expect(screen.getByRole("status")).toHaveTextContent("Loading league...");
  });

  it("explains why a connection has no league instead of showing empty tabs", async () => {
    renderDetail(vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      connection: connectionListFixture.connections[1],
      league: null,
    })))));

    expect(await screen.findByRole("heading", { name: "Pigskin Power Bottoms" })).toBeVisible();
    expect(screen.getByText(/Paste your espn_s2 and SWID cookies/u)).toBeVisible();
    expect(screen.queryByRole("tab", { name: /Teams/u })).not.toBeInTheDocument();
  });

  it("reports a failed load as an error the owner can read", async () => {
    renderDetail(vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ error: { code: "provider_unreachable", message: "Sleeper is down." } }),
      { status: 502 },
    ))));

    expect(await screen.findByText("Sleeper is down.")).toBeVisible();
  });

  it("counts teams and matchups on their tabs and switches between them", async () => {
    const user = userEvent.setup();
    renderDetail(vi.fn(() => Promise.resolve(
      new Response(JSON.stringify(connectionDetailFixture)),
    )));

    expect(await screen.findByRole("tab", { name: "Teams (2)" })).toBeVisible();
    expect(screen.getByText(/Last synced/u)).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Matchups (2)" }));
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.queryByText("Giant Dolphins")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Teams (2)" }));
    expect(screen.getByText("Giant Dolphins")).toBeVisible();
  });
});
