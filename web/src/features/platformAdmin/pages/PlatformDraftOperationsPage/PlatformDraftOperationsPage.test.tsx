import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PlatformDraftOperationsPage } from "./PlatformDraftOperationsPage";

const schedule = {
  generatedAt: "2026-08-22T12:00:00.000Z",
  timezone: "America/New_York",
  today: [{
    draftFormat: "auction",
    endedAt: null,
    leagueId: "league-1",
    leagueName: "Sunday Games",
    readiness: "room_not_created",
    roomId: null,
    roomStatus: null,
    seasonId: "season-1",
    seasonName: "2026 season",
    seasonYear: 2026,
    startedAt: null,
    startsAt: "2026-08-22T23:00:00.000Z",
    teamCount: 12,
  }, {
    draftFormat: "snake",
    endedAt: null,
    leagueId: "league-2",
    leagueName: "Room Ready League",
    readiness: "room_ready",
    roomId: "room-2",
    roomStatus: null,
    seasonId: "season-2",
    seasonName: "2026 season",
    seasonYear: 2026,
    startedAt: null,
    startsAt: "2026-08-22T23:30:00.000Z",
    teamCount: 10,
  }, {
    draftFormat: "auction",
    endedAt: null,
    leagueId: "league-3",
    leagueName: "Live League",
    readiness: "room_ready",
    roomId: "room-3",
    roomStatus: "live",
    seasonId: "season-3",
    seasonName: "2026 season",
    seasonYear: 2026,
    startedAt: "2026-08-22T22:00:00.000Z",
    startsAt: "2026-08-22T22:00:00.000Z",
    teamCount: 14,
  }],
  upcoming: [],
  summary: {
    estimatedDraftDurationMinutes: 180,
    liveNow: 0,
    peakConcurrentDrafts: 1,
    peakWindow: {
      endsAt: "2026-08-23T02:00:00.000Z",
      startsAt: "2026-08-22T23:00:00.000Z",
    },
    roomsNotCreated: 1,
    scheduledToday: 3,
    scheduledUpcoming: 0,
  },
};

const server = setupServer(
  http.get("/api/platform-admin/drafts", () => HttpResponse.json(schedule)),
);

beforeAll(() => { server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });

describe("PlatformDraftOperationsPage", () => {
  const renderPage = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PlatformDraftOperationsPage />
      </QueryClientProvider>,
    );
  };

  it("shows creator capacity and room-readiness visibility", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Draft operations" })).toBeVisible();
    expect(screen.getByText("3 scheduled today")).toBeVisible();
    expect(screen.getByText("Peak: 1 concurrent")).toBeVisible();
    expect(screen.getByText("Sunday Games")).toBeVisible();
    expect(screen.getByText("Room not created")).toBeVisible();
    expect(screen.getByText("12 teams · Auction")).toBeVisible();
    expect(screen.getByText("Room ready")).toBeVisible();
    expect(screen.getByText("10 teams · Snake")).toBeVisible();
    expect(screen.getByText("Live")).toBeVisible();
    expect(screen.getByText("No drafts are scheduled in the next 30 days.")).toBeVisible();
  });

  it("shows a recoverable error state", async () => {
    server.use(http.get("/api/platform-admin/drafts", () =>
      HttpResponse.json({ error: { code: "unavailable", message: "Unavailable" } }, { status: 503 })));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Draft operations are unavailable. Refresh and try again.",
    );
  });
});
