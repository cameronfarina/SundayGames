import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderMyTeamPage } from "./MyTeamPage.testUtils";
import {
  assignedLeague,
  keepers,
  onboarding,
  season,
  server,
  usePreDraftHandlers,
} from "./MyTeamPage.testServer";

describe("MyTeamPage before the draft ends", () => {
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

  it("shows keeper cost, auction budget, and open roster spots", async () => {
    usePreDraftHandlers();
    renderMyTeamPage();

    expect(await screen.findByRole("heading", { name: "Short King" })).toBeVisible();
    expect(screen.getByText("$50", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("$150", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("15", { selector: "strong" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "De'Von Achane" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "$50" })).toBeVisible();
    expect(screen.getByText("Coach unlocks after the draft is final.")).toBeVisible();
  });

  it("shows an empty keeper state without inventing spend", async () => {
    usePreDraftHandlers();
    server.use(http.get("/seasons/season-2026/keepers", () => HttpResponse.json({ keepers: [] })));
    renderMyTeamPage();

    expect(await screen.findByText("No keepers are assigned to Short King.")).toBeVisible();
    expect(screen.getByText("$0", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("$200", { selector: "strong" })).toBeVisible();
  });

  it("shows keeper rounds instead of auction dollars for a snake league", async () => {
    usePreDraftHandlers();
    server.use(
      http.get("/seasons/season-2026", () => HttpResponse.json(season("snake"))),
      http.get("/seasons/season-2026/keepers", () => HttpResponse.json({
        keepers: [
          { ...keepers[0], price: 0, keeperRound: 4 },
          {
            teamId: "team-owner11",
            playerName: "DeVonta Smith",
            position: "WR",
            price: 0,
            source: "keeper",
          },
        ],
      })),
    );
    renderMyTeamPage();

    expect(await screen.findByRole("cell", { name: "Round 4" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Round -" })).toBeVisible();
    expect(screen.queryByText("Budget left")).not.toBeInTheDocument();
  });

  it("uses the requested active league from the URL", async () => {
    const otherLeague = {
      ...assignedLeague,
      leagueId: "league-2",
      leagueName: "Night Games",
      seasonId: "season-2027",
      seasonYear: 2027,
      membership: { ...assignedLeague.membership, teamDisplayName: "Night Shift" },
    };
    server.use(
      http.get("/onboarding", () => HttpResponse.json({
        account: { id: "account-user", email: "user@example.com" },
        leagues: [assignedLeague, otherLeague],
      })),
      http.get("/seasons/season-2027", () => HttpResponse.json(season("auction", "season-2027"))),
      http.get("/seasons/season-2027/keepers", () => HttpResponse.json({ keepers: [] })),
    );
    renderMyTeamPage("/my-team?seasonId=season-2027");

    expect(await screen.findByRole("heading", { name: "Night Shift" })).toBeVisible();
  });

  it("marks a started room as unfinished", async () => {
    const liveLeague = { ...assignedLeague, liveDraft: { roomId: "room-1", status: "live" } };
    usePreDraftHandlers();
    server.use(http.get("/onboarding", () => HttpResponse.json(onboarding(liveLeague))));
    renderMyTeamPage();

    expect(await screen.findByText("Draft in progress")).toBeVisible();
    expect(screen.getByText("Your final roster and rank will appear when the commissioner ends the draft.")).toBeVisible();
  });

  it("reports a season request failure", async () => {
    usePreDraftHandlers();
    server.use(http.get("/seasons/season-2026", () => HttpResponse.json({
      error: { code: "season_unavailable", message: "League settings are unavailable." },
    }, { status: 503 })));
    renderMyTeamPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("League settings are unavailable.");
  });

  it("reports a keeper request failure", async () => {
    usePreDraftHandlers();
    server.use(http.get("/seasons/season-2026/keepers", () => HttpResponse.json({
      error: { code: "keepers_unavailable", message: "Keepers are unavailable." },
    }, { status: 503 })));
    renderMyTeamPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Keepers are unavailable.");
  });
});
