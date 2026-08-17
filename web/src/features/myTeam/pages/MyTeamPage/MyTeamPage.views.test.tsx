import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useLocation } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderMyTeamPage } from "./MyTeamPage.testUtils";
import { server, usePreDraftHandlers } from "./MyTeamPage.testServer";

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

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

  it("forwards the former news view to the first-class player news page", async () => {
    usePrepHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=news", <LocationProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/leagues/sunday-games/player-news",
      );
    });
  });
});
