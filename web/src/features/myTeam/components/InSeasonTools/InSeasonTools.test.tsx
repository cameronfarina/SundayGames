import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { inSeasonTeam } from "../../api/inSeason.fixture";
import { InSeasonTools, type InSeasonView } from "./InSeasonTools";

const renderTools = (view: InSeasonView, fetcher: typeof fetch) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>
    <InSeasonTools roomId="room-1" view={view} />
  </QueryClientProvider>);
};

const servesTeam = vi.fn(() => Promise.resolve(new Response(JSON.stringify(inSeasonTeam))));

describe("InSeasonTools", () => {
  it("asks the in-season route once and renders the lineup with the roster ranks", async () => {
    const requested: (RequestInfo | URL)[] = [];
    renderTools("lineup", vi.fn((input: RequestInfo | URL) => {
      requested.push(input);
      return Promise.resolve(new Response(JSON.stringify(inSeasonTeam)));
    }));

    expect(await screen.findByRole("heading", { name: "Start these players" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Every player you roster" })).toBeVisible();
    expect(requested).toEqual(["/live-rooms/room-1/in-season"]);
  });

  it("renders the waiver board from the same payload", async () => {
    renderTools("waivers", servesTeam);

    expect(await screen.findByRole("heading", { name: "Free agents worth a claim" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Start these players" })).not.toBeInTheDocument();
  });

  it("reports a loading state and then a server failure", async () => {
    const failing = vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ error: { code: "room_not_ended", message: "In-season tools open once the draft ends." } }),
      { status: 409 },
    )));
    renderTools("lineup", failing);

    expect(screen.getByRole("status")).toHaveTextContent("Loading FantasyPros data...");
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("In-season tools open once the draft ends.");
  });
});
