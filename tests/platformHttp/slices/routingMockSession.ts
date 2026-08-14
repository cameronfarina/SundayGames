import { expect, expectBodyRecord, expectString, isRecord, now } from "../support/index.js";
import type { RoutingContext } from "./routingContext.js";

export const verifyRoutingMockSession = async ({ handle, owner11, season, camTeam }: RoutingContext, sethSimulationId: string): Promise<void> => {
    const createdMockSession = await handle({
      method: "POST",
      path: "/mock-sessions",
      sessionToken: owner11.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        draftMode: { format: "auction", mockCount: 5, label: "Practice auction" },
        now,
      },
    });
    const mockSession = expectBodyRecord(createdMockSession.body).mockSession;
    if (!isRecord(mockSession)) throw new Error("Expected mock session response.");
    const mockSessionId = expectString(mockSession.id);

    expect(createdMockSession.status).toBe(201);

    const leakedResultReference = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_leak",
        command: "show owner04 result",
        idempotencyKey: "mock:leak",
        latestResultRef: { kind: "simulation-result", id: sethSimulationId },
        now: new Date(now.getTime() + 1_500).toISOString(),
      },
    });

    expect(leakedResultReference).toEqual({
      status: 403,
      body: {
        error: {
          code: "private_resource",
          message: "This prep artifact belongs to another user.",
        },
      },
    });

    const listedMockSessions = await handle({
      method: "GET",
      path: "/mock-sessions",
      sessionToken: owner11.sessionToken,
      query: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
      },
    });

    expect(listedMockSessions.body).toMatchObject({
      mockSessions: [expect.objectContaining({
        id: mockSessionId,
        commandLog: [],
        latestResultRef: undefined,
      })],
    });

    const appendedMockSession = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_puka",
        command: "draft puka for 62",
        idempotencyKey: "mock:puka:62",
        now: new Date(now.getTime() + 2_000).toISOString(),
      },
    });

    expect(appendedMockSession.body).toMatchObject({
      mockSession: expect.objectContaining({
        id: mockSessionId,
        commandLog: [expect.objectContaining({ id: "cmd_puka" })],
      }),
    });

    const resetMockSession = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/reset`,
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        now: new Date(now.getTime() + 3_000),
      },
    });

    expect(resetMockSession.body).toMatchObject({
      mockSession: expect.objectContaining({
        id: mockSessionId,
        revision: 2,
        commandLog: [],
      }),
    });

    const staleMockReset = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/reset`,
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
      },
    });

    expect(staleMockReset).toEqual({
      status: 409,
      body: {
        error: {
          code: "stale_revision",
          message: "Mock draft session changed since this action was prepared. Refresh and try again.",
        },
      },
    });
};
