import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  liveDraftServer,
  renderLiveDraftPage,
  useRoomResponse,
} from "./LiveDraftPage.testSupport";
import { liveRoom } from "../../test/liveDraftFixtures";

beforeAll(() => {
  vi.stubGlobal("EventSource", undefined);
  liveDraftServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => { liveDraftServer.resetHandlers(); });
afterAll(() => {
  liveDraftServer.close();
  vi.unstubAllGlobals();
});

describe("LiveDraftPage states", () => {
  it("shows a loading state while resolving a clean league draft URL", () => {
    liveDraftServer.use(http.get("/onboarding", async () => await new Promise<Response>(() => undefined)));

    renderLiveDraftPage("/leagues/sunday-games/draft");

    expect(screen.getByRole("status")).toHaveTextContent("Opening draft room");
  });

  it("opens the league's active room from its clean draft URL", async () => {
    liveDraftServer.use(http.get("/onboarding", () => HttpResponse.json({
      account: { email: "user@example.com", id: "account-1" },
      leagues: [{
        canManageLeague: true,
        leagueId: "league-1",
        leagueName: "Sunday Games",
        leagueSlug: "sunday-games",
        liveDraft: { roomId: "room-1", status: "setup" },
        membership: { role: "owner" },
        readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
        seasonId: "season-1",
        seasonYear: 2026,
      }],
    })));
    useRoomResponse();

    renderLiveDraftPage("/leagues/sunday-games/draft");

    expect(await screen.findByRole("heading", { name: "Short King roster" })).toBeVisible();
  });

  it("rejects incomplete room links without adding another main landmark", () => {
    renderLiveDraftPage("/draft-room?roomId=room-1");
    expect(screen.getByText("This draft link is missing its league season.")).toBeVisible();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("offers sign in when the room requires authentication", async () => {
    liveDraftServer.use(http.get("/live-rooms/:roomId", () => HttpResponse.json({
      error: { code: "auth_required", message: "Sign in before using this workspace." },
    }, { status: 401 })));
    renderLiveDraftPage();
    expect(await screen.findByText("Sign in before using this workspace.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fdraft-room%3FseasonId%3Dseason-1%26roomId%3Droom-1",
    );
  });

  it("rejects a room from another season", async () => {
    useRoomResponse({ ...liveRoom, seasonId: "season-2" });
    renderLiveDraftPage();
    expect(await screen.findByText("This draft room does not belong to the requested league season."))
      .toBeVisible();
  });

  it("renders members without commissioner controls", async () => {
    useRoomResponse({ ...liveRoom, canMutateRoom: false, role: "member" });
    renderLiveDraftPage();
    expect(await screen.findByRole("heading", { name: "Short King roster" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Sale command" })).not.toBeInTheDocument();
  });
});
