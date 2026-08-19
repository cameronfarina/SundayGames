import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  liveDraftServer,
  renderLiveDraftPage,
  useAdvisoryResponse,
  useRoomResponse,
} from "./LiveDraftPage.testSupport";
import { liveAdvisory } from "../../test/liveDraftFixtures";

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
