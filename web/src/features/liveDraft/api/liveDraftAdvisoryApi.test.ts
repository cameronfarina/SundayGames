import { describe, expect, it, vi } from "vitest";
import { getLiveDraftAdvisory } from "./liveDraftAdvisoryApi";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";

const advisoryBody = {
  configured: true,
  basis: "ros",
  week: 4,
  players: [{ normalizedPlayerName: "Puka Nacua", rankEcr: 3, momentum: "steady" }],
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("getLiveDraftAdvisory", () => {
  it("requests the advisory for an encoded room id", async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse(advisoryBody)));

    const advisory = await getLiveDraftAdvisory("room 1/2", { fetcher });

    expect(fetcher).toHaveBeenCalledWith("/live-rooms/room%201%2F2/advisory", expect.anything());
    expect(advisory.players).toHaveLength(1);
  });

  it("passes an abort signal through to the request", async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse(advisoryBody)));
    const controller = new AbortController();

    await getLiveDraftAdvisory("room-1", { fetcher, signal: controller.signal });

    expect(fetcher).toHaveBeenCalledWith(
      "/live-rooms/room-1/advisory",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("throws the server error code when the advisory is refused", async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse(
      { error: { code: "membership_required", message: "Join this league first." } },
      403,
    )));

    await expect(getLiveDraftAdvisory("room-1", { fetcher })).rejects.toBeInstanceOf(PlatformApiError);
  });
});
