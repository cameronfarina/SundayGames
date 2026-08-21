import { describe, expect, it } from "vitest";
import { platformLoadRequestsFromManifest } from "../scripts/platformLoadTest/manifest.js";

const scenario = {
  draftClients: 4,
  draftClientsPerLeague: 2,
  leagueCount: 2,
  newsReaders: 3,
  simulationRequests: 2,
};

const draft = (roomId: string, sessionTokens: readonly string[]) => ({
  roomId,
  sessionTokens,
  mutation: { action: "sales" as const, body: {}, sessionToken: sessionTokens[0] ?? "" },
});

describe("platform load-test manifest", () => {
  it("expands league participants and round-robins account traffic", () => {
    const requests = platformLoadRequestsFromManifest(scenario, {
      drafts: [
        draft("room-1", ["draft-1", "draft-2"]),
        draft("room-2", ["draft-3", "draft-4"]),
      ],
      newsSessionTokens: ["news-1", "news-2"],
      simulationRequests: [
        { sessionToken: "sim-1", body: { seasonId: "season-1", count: 1 } },
        { sessionToken: "sim-2", body: { seasonId: "season-2", count: 1 } },
        { sessionToken: "sim-3", body: { seasonId: "season-3", count: 1 } },
      ],
    });

    expect(requests.draftClients).toEqual([
      { roomId: "room-1", sessionToken: "draft-1" },
      { roomId: "room-1", sessionToken: "draft-2" },
      { roomId: "room-2", sessionToken: "draft-3" },
      { roomId: "room-2", sessionToken: "draft-4" },
    ]);
    expect(requests.newsRequests.map(request => request.sessionToken))
      .toEqual(["news-1", "news-2", "news-1"]);
    expect(requests.simulationRequests).toHaveLength(2);
    expect(requests.simulationRequests[0]).toMatchObject({
      body: { seasonId: "season-1", count: 1 },
      method: "POST",
      path: "/season-simulations",
      sessionToken: "sim-1",
    });
  });

  it("rejects a manifest that cannot represent the requested draft load", () => {
    expect(() => platformLoadRequestsFromManifest(scenario, {
      drafts: [draft("room-1", ["draft-1"])],
      newsSessionTokens: ["news-1"],
      simulationRequests: [{ sessionToken: "sim-1", body: { count: 1 } }],
    })).toThrow("exactly 2 leagues");
  });

  it("rejects duplicate rooms that would misrepresent the league count", () => {
    expect(() => platformLoadRequestsFromManifest(scenario, {
      drafts: [
        draft("same-room", ["draft-1", "draft-2"]),
        draft("same-room", ["draft-3", "draft-4"]),
      ],
      newsSessionTokens: ["news-1"],
      simulationRequests: [
        { sessionToken: "sim-1", body: { count: 1 } },
        { sessionToken: "sim-2", body: { count: 1 } },
        { sessionToken: "sim-3", body: { count: 1 } },
      ],
    })).toThrow("distinct room IDs");
  });

  it("rejects duplicate sessions within a draft room", () => {
    expect(() => platformLoadRequestsFromManifest(scenario, {
      drafts: [
        draft("room-1", ["duplicate", "duplicate"]),
        draft("room-2", ["draft-3", "draft-4"]),
      ],
      newsSessionTokens: ["news-1"],
      simulationRequests: [
        { sessionToken: "sim-1", body: { count: 1 } },
        { sessionToken: "sim-2", body: { count: 1 } },
        { sessionToken: "sim-3", body: { count: 1 } },
      ],
    })).toThrow("distinct sessions within each league");
  });

  it("requires at least three distinct simulation sessions", () => {
    expect(() => platformLoadRequestsFromManifest(scenario, {
      drafts: [
        draft("room-1", ["draft-1", "draft-2"]),
        draft("room-2", ["draft-3", "draft-4"]),
      ],
      newsSessionTokens: ["news-1"],
      simulationRequests: [
        { sessionToken: "same-sim", body: { count: 1 } },
        { sessionToken: "same-sim", body: { count: 1 } },
        { sessionToken: "sim-2", body: { count: 1 } },
      ],
    })).toThrow("at least three distinct simulation sessions");
  });

  it("requires each room mutation to use one of its connected sessions", () => {
    expect(() => platformLoadRequestsFromManifest(scenario, {
      drafts: [
        {
          roomId: "room-1",
          sessionTokens: ["draft-1", "draft-2"],
          mutation: { action: "sales", body: {}, sessionToken: "not-connected" },
        },
        {
          roomId: "room-2",
          sessionTokens: ["draft-3", "draft-4"],
          mutation: { action: "sales", body: {}, sessionToken: "draft-3" },
        },
      ],
      newsSessionTokens: ["news-1"],
      simulationRequests: [
        { sessionToken: "sim-1", body: { count: 1 } },
        { sessionToken: "sim-2", body: { count: 1 } },
        { sessionToken: "sim-3", body: { count: 1 } },
      ],
    })).toThrow("mutation session must be one of its connected sessions");
  });
});
