import { describe, expect, it, vi } from "vitest";
import type { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import {
  getPlayerCatalog,
  listPracticeShortlist,
  listSimulationHistory,
  removePracticeTarget,
  savePracticeTarget,
} from "./practiceApi";

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status: 200,
});

const player = { expectedPrice: 73, name: "Puka Nacua", position: "WR" };
const simulation = {
  completedCount: 1,
  draftFormat: "auction",
  playerExposure: [],
  positionCounts: {},
  runCount: 1,
  seedPrefix: "practice-test",
  strategy: { preferredPositions: [], rawInput: "", summary: "Balanced", warnings: [] },
};

describe("Practice API", () => {
  it("builds encoded catalog queries", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ draftFormat: "auction", players: [player] }));

    await expect(getPlayerCatalog({ fetcher, seasonId: "season / 1", strategy: "hero-rb" }))
      .resolves.toMatchObject({ players: [player] });
    expect(fetcher.mock.calls[0]?.[0]).toBe("/player-catalog?seasonId=season+%2F+1&strategy=hero-rb");
  });

  it("supports the complete shortlist lifecycle", async () => {
    const item = {
      createdAt: "2026-08-13T12:00:00.000Z",
      id: "target-1",
      leagueId: "league-1",
      playerName: "Puka Nacua",
      position: "WR",
      priority: 1,
      seasonId: "season-1",
      updatedAt: "2026-08-13T12:00:00.000Z",
      userId: "user-1",
    };
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [item] }))
      .mockResolvedValueOnce(jsonResponse({ item: { ...item, maxBid: 70 } }))
      .mockResolvedValueOnce(jsonResponse({ removed: true }));

    await expect(listPracticeShortlist({ fetcher, seasonId: "season-1" }))
      .resolves.toEqual([item]);
    await expect(savePracticeTarget({ fetcher, maxBid: 70, playerName: "Puka Nacua", position: "WR", seasonId: "season-1" }))
      .resolves.toMatchObject({ maxBid: 70 });
    await expect(removePracticeTarget({ fetcher, playerName: "Puka Nacua", seasonId: "season-1" }))
      .resolves.toBe(true);
  });

  it("loads compact simulation history", async () => {
    const history = [{ completedAt: "2026-08-13T12:00:00.000Z", id: "run-1", simulation }];
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ history }));

    const simulationHistory = await listSimulationHistory({ fetcher, seasonId: "season-1" });
    expect(simulationHistory.map(item => ({ id: item.id, runCount: item.simulation.runCount })))
      .toEqual([{ id: "run-1", runCount: 1 }]);
  });

  it("rejects malformed payloads instead of trusting server JSON", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({ players: [{ name: "Missing fields" }] }));

    await expect(getPlayerCatalog({ fetcher, strategy: "balanced" }))
      .rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({ code: "invalid_response" }));
  });
});
