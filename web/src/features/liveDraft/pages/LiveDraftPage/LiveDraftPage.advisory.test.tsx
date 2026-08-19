import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  liveDraftServer,
  renderLiveDraftPage,
  useAdvisoryResponse,
  useRoomResponse,
} from "./LiveDraftPage.testSupport";
import { injuredAdvisory, liveAdvisory } from "../../test/liveDraftFixtures";

beforeAll(() => {
  vi.stubGlobal("EventSource", undefined);
  liveDraftServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => { liveDraftServer.resetHandlers(); });
afterAll(() => {
  liveDraftServer.close();
  vi.unstubAllGlobals();
});

describe("LiveDraftPage FantasyPros overlay", () => {
  it("shows FantasyPros ranks and attribution on the board once the advisory loads", async () => {
    useRoomResponse();
    useAdvisoryResponse(liveAdvisory);

    renderLiveDraftPage();

    expect(await screen.findByRole("columnheader", { name: "FP rank" })).toBeVisible();
    expect(screen.getByText(/Data by FantasyPros/u)).toHaveTextContent("rest-of-season ranks");
  });

  // Rest-of-season ranks are what a real room serves, and FantasyPros gives them
  // no week. The board once dropped the whole column over that: the schema
  // demanded a positive week, the room sent the 0 FantasyPros echoes back, the
  // parse threw, and a failed advisory query renders as no overlay at all. This
  // sends the wire shape a room actually sends, written out rather than taken
  // from a fixture, so the column has to survive it.
  it("draws the column for rest-of-season ranks, which carry no week", async () => {
    useRoomResponse();
    liveDraftServer.use(http.get("/live-rooms/:roomId/advisory", () => HttpResponse.json({
      configured: true,
      basis: "ros",
      week: null,
      players: [{
        normalizedPlayerName: "puka nacua",
        rankEcr: 3,
        tier: 1,
        positionRank: "WR2",
        momentum: "steady",
      }],
    })));

    renderLiveDraftPage();

    expect(await screen.findByRole("columnheader", { name: "FP rank" })).toBeVisible();
    expect(screen.getByText(/Data by FantasyPros/u)).toHaveTextContent("rest-of-season ranks");
  });

  it("chips an injured player once the advisory loads", async () => {
    useRoomResponse();
    useAdvisoryResponse(injuredAdvisory);

    renderLiveDraftPage();

    const chip = await screen.findByRole("button", {
      name: /Nacua is questionable with a knee injury/u,
    });
    expect(chip).toHaveTextContent("INJ");
  });

  it("draws exactly today's board when the advisory request is refused", async () => {
    useRoomResponse();
    liveDraftServer.use(http.get("/live-rooms/:roomId/advisory", () => HttpResponse.json(
      { error: { code: "membership_required", message: "Join this league first." } },
      { status: 403 },
    )));

    renderLiveDraftPage();

    expect(await screen.findByRole("heading", { name: "Available players" })).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole("columnheader", { name: "FP rank" })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Data by FantasyPros/u)).not.toBeInTheDocument();
  });
});
