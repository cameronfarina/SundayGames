import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { playerNewsFeedFixture } from "../../api/playerNews.fixture";
import { renderMyTeamPage } from "./MyTeamPage.testUtils";
import { server, usePreDraftHandlers } from "./MyTeamPage.testServer";

const target = {
  createdAt: "2026-08-16T12:00:00.000Z",
  id: "target-1",
  leagueId: "league-1",
  maxBid: 25,
  playerName: "Ladd McConkey",
  position: "WR",
  priority: 1,
  seasonId: "season-2026",
  updatedAt: "2026-08-16T12:00:00.000Z",
  userId: "user-1",
};

const simulation = {
  completedCount: 25,
  draftFormat: "auction",
  outcomes: [{ favorite: true, rank: 1, runNumber: 7, userWeek1Points: 119.8 }],
  runCount: 25,
  strategy: { preferredPositions: [], rawInput: "", summary: "High ceiling", warnings: [] },
};

const usePrepHandlers = (): void => {
  usePreDraftHandlers();
  server.use(
    http.get("/practice-shortlist", () => HttpResponse.json({ items: [target] })),
    http.get("/season-simulations", () => HttpResponse.json({
      history: [{ id: "history-1", note: "Favorite roster", simulation }],
    })),
    http.get("/api/player-news", () => HttpResponse.json(playerNewsFeedFixture)),
  );
};

describe("MyTeamPage views", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    document.body.replaceChildren();
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  it("opens the reusable draft plan and saved simulation outcomes", async () => {
    usePrepHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=prep");

    expect(await screen.findByRole("heading", { name: "Draft targets" })).toBeVisible();
    expect(screen.getByText("Ladd McConkey")).toBeVisible();
    expect(screen.getByText("Run 7 · 119.8 projected Week 1 points")).toBeVisible();
    expect(screen.getByRole("link", { name: "Draft prep" })).toHaveAttribute("aria-current", "page");
  });

  it("opens roster news from RotoWire and Mockd evidence", async () => {
    usePrepHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=news");

    expect(await screen.findByRole("heading", { name: "Player news" })).toBeVisible();
    expect(await screen.findByText("De'Von Achane was limited in practice.")).toBeVisible();
    expect(screen.getByText("Mockd evidence")).toBeVisible();
    expect(screen.getByRole("link", { name: "Player news" })).toHaveAttribute("aria-current", "page");
  });
});
