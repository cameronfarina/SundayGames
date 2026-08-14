import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
afterEach(() => {
  liveDraftServer.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  liveDraftServer.close();
  vi.unstubAllGlobals();
});

describe("LiveDraftPage commissioner workflow", () => {
  it("prefills and logs a sale from the board", async () => {
    const user = userEvent.setup();
    useRoomResponse();
    liveDraftServer.use(http.post("/live-rooms/:roomId/sales", async ({ request }) => {
      expect(await request.json()).toEqual(expect.objectContaining({
        command: "Cam drafted Puka Nacua for 62",
        expectedRevision: 2,
      }));
      return HttpResponse.json({ room: { ...liveRoom, revision: 3 } });
    }));
    renderLiveDraftPage();

    await user.click(await screen.findByRole("button", { name: "Use Puka Nacua in sale command" }));
    const input = screen.getByRole("textbox", { name: "Sale command" });
    expect(input).toHaveValue("Cam drafted Puka Nacua for ");
    await user.type(input, "62{Enter}");
    expect(await screen.findByText("Draft room updated.")).toBeVisible();
    expect(input).toHaveValue("");
  });

  it("undoes the latest sale after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    useRoomResponse();
    liveDraftServer.use(http.post("/live-rooms/:roomId/undo", () => HttpResponse.json({
      room: { ...liveRoom, revision: 3, salesLog: [] },
    })));
    renderLiveDraftPage();

    await user.click(await screen.findByRole("button", { name: "Undo latest sale" }));
    expect(confirm).toHaveBeenCalledWith("Undo the latest sale of De'Von Achane?");
    expect(await screen.findByText("Draft room updated.")).toBeVisible();
  });

  it("offers an explicit recovery when ending an incomplete draft", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    useRoomResponse();
    let calls = 0;
    const requestBodies: unknown[] = [];
    liveDraftServer.use(http.post("/live-rooms/:roomId/end", async ({ request }) => {
      calls += 1;
      const body: unknown = await request.json();
      requestBodies.push(body);
      if (calls === 1) {
        return HttpResponse.json({
          error: { code: "draft_incomplete", message: "Teams still have open slots." },
        }, { status: 409 });
      }
      return HttpResponse.json({ room: { ...liveRoom, revision: 3, status: "ended" } });
    }));
    renderLiveDraftPage();

    await user.click(await screen.findByRole("button", { name: "End draft" }));
    expect(await screen.findByRole("heading", { name: "Draft complete" })).toBeVisible();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(requestBodies).toEqual([
      expect.not.objectContaining({ allowIncomplete: true }),
      expect.objectContaining({ allowIncomplete: true }),
    ]);
  });

  it("prepares a final download and can reopen an incomplete room", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    useRoomResponse({
      ...liveRoom,
      status: "ended",
      exportReadiness: { status: "ready", blockers: [], completedRevision: 2 },
    });
    liveDraftServer.use(
      http.post("/live-rooms/:roomId/export-artifacts", () => HttpResponse.json({
        artifact: {
          id: "export-1", leagueId: "league-1", seasonId: "season-1", roomId: "room-1",
          format: "csv", sourceRevision: 2, createdAt: "2026-08-13T20:00:00.000Z",
          storageKey: "exports/draft.csv", sha256: "abc", byteLength: 12,
          contentType: "text/csv; charset=utf-8",
        },
        content: "Player,Price",
      }, { status: 201 })),
      http.post("/live-rooms/:roomId/reopen", () => HttpResponse.json({
        room: { ...liveRoom, revision: 3, status: "paused" },
      })),
    );
    renderLiveDraftPage();

    await user.click(await screen.findByRole("button", { name: "Prepare final CSV" }));
    expect(await screen.findByRole("link", { name: "Download final CSV" })).toHaveAttribute(
      "href",
      "data:text%2Fcsv%3B%20charset%3Dutf-8,Player%2CPrice",
    );
    await user.click(screen.getByRole("button", { name: "Reopen draft" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Resume draft" })).toBeVisible());
  });
});
