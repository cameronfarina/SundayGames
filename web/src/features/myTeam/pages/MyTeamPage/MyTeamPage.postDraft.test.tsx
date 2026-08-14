import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { endedLeague, postDraftResult } from "./MyTeamPage.postDraft.fixture";
import { renderMyTeamPage } from "./MyTeamPage.testUtils";
import { onboarding, server } from "./MyTeamPage.testServer";

const usePostDraftHandlers = (result: Record<string, unknown> = postDraftResult): void => {
  server.use(
    http.get("/onboarding", () => HttpResponse.json(onboarding(endedLeague))),
    http.get("/live-rooms/room-1/my-team", () => HttpResponse.json(result)),
  );
};

describe("MyTeamPage after the draft", () => {
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

  it("shows private roster rank, findings, and honest coach readiness", async () => {
    usePostDraftHandlers();
    renderMyTeamPage();

    expect(await screen.findByRole("heading", { name: "Short King" })).toBeVisible();
    expect(screen.getByText("#2", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("14", { selector: "strong" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "DeVonta Smith" })).toBeVisible();
    expect(screen.getByText("The starting lineup projects near the top of the league.")).toBeVisible();
    expect(screen.getByText("Bench depth trails the league.")).toBeVisible();
    expect(screen.getByText("Start De'Von Achane at RB.")).toBeVisible();
    expect(screen.getByText("Current free agents are required for pickup and drop advice.")).toBeVisible();
    expect(screen.getByText("Lineup ready", { selector: "strong" })).toBeVisible();
  });

  it("reports a ready coach without inventing actions", async () => {
    const ready = { status: "ready", reasons: [], snapshotIds: ["projection-1"] };
    usePostDraftHandlers({
      ...postDraftResult,
      analysis: {
        ...postDraftResult.analysis,
        recommendationReadiness: { startSit: ready, pickupDrop: ready },
        recommendations: {
          startSit: { ...ready, records: [] },
          pickupDrop: { ...ready, records: [] },
        },
      },
    });
    renderMyTeamPage();

    expect(await screen.findByText("Ready", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("No coach actions are available yet.")).toBeVisible();
  });

  it("shows readiness reasons that do not identify an input", async () => {
    const unavailable = {
      status: "unavailable",
      reasons: [{ code: "snapshot_missing", message: "Current projections are required." }],
      snapshotIds: [],
    };
    usePostDraftHandlers({
      ...postDraftResult,
      analysis: {
        ...postDraftResult.analysis,
        recommendationReadiness: { startSit: unavailable, pickupDrop: unavailable },
      },
    });
    renderMyTeamPage();

    expect(await screen.findByText("Needs current data", { selector: "strong" })).toBeVisible();
    expect(screen.getAllByText("Current projections are required.")).toHaveLength(2);
  });

  it("explains an unavailable rank and an empty roster", async () => {
    usePostDraftHandlers({
      ...postDraftResult,
      roster: { ...postDraftResult.roster, players: [] },
      analysis: {
        ...postDraftResult.analysis,
        ranking: {
          status: "unavailable",
          teamCount: 14,
          reasons: [{
            code: "roster_materially_incomplete",
            message: "The roster is incomplete, so draft rank is unavailable.",
            projectionSnapshotId: "projection-1",
          }],
        },
        strengths: [],
        risks: [],
      },
    });
    renderMyTeamPage();

    expect((await screen.findAllByText("Rank unavailable")).length).toBe(2);
    expect(screen.getByText("The roster is incomplete, so draft rank is unavailable.")).toBeVisible();
    expect(screen.getByText("No players were recorded for this team.")).toBeVisible();
    expect(screen.getByText("No major roster findings were generated.")).toBeVisible();
  });

  it("reports post-draft analysis failures", async () => {
    server.use(
      http.get("/onboarding", () => HttpResponse.json(onboarding(endedLeague))),
      http.get("/live-rooms/room-1/my-team", () => HttpResponse.json({
        error: { code: "post_draft_analysis_unavailable", message: "My Team analysis is unavailable." },
      }, { status: 503 })),
    );
    renderMyTeamPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("My Team analysis is unavailable.");
  });
});
