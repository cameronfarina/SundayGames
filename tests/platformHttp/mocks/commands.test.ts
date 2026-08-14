import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, mockRunner, snakeSeason } from "../support/index.js";
import type { PlatformHttpRequest } from "../support/index.js";

describe("platform HTTP contract", () => {
it("returns typed command-log limit responses without breaking stored-command retries", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: {
        maxCommandsPerSession: 2,
        maxCommandBytesPerSession: 24,
        maxActiveSessionsPerUser: 100,
        maxActiveSessionsPerUserSeason: 100,
        maxCreationsPerWindow: 100,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner11 = await createLoggedInAccount(handle, "mock-command-limits@example.com");
    const season = snakeSeason();
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected a team fixture.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: team.ownerId,
          teamId: team.id,
        }],
      },
    });
    const createMockSession = async (): Promise<string> => {
      const created = await handle({
        method: "POST",
        path: "/mock-sessions",
        sessionToken: owner11.sessionToken,
        body: {
          leagueId: season.leagueId,
          seasonId: season.id,
          ownerId: team.ownerId,
          teamId: team.id,
          draftMode: { format: "snake", mockCount: 1 },
        },
      });
      return expectString(expectBodyRecord(expectBodyRecord(created.body).mockSession).id);
    };
    const bytesSessionId = await createMockSession();
    const utf8CommandRequest: PlatformHttpRequest = {
      method: "POST",
      path: `/mock-sessions/${bytesSessionId}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_utf8",
        idempotencyKey: "command:utf8",
        command: "éé",
      },
    };

    await expect(handle(utf8CommandRequest)).resolves.toMatchObject({ status: 200 });
    await expect(handle(utf8CommandRequest)).resolves.toMatchObject({ status: 200 });
    await expect(handle({
      method: "POST",
      path: `/mock-sessions/${bytesSessionId}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_over_bytes",
        command: "x",
      },
    })).resolves.toEqual({
      status: 413,
      body: {
        error: {
          code: "session_command_bytes_limit",
          message: "This mock draft reached its command storage limit. Finish or reset it before continuing.",
        },
      },
    });

    const countSessionId = await createMockSession();
    for (const [index, command] of ["a", "b"].entries()) {
      await expect(handle({
        method: "POST",
        path: `/mock-sessions/${countSessionId}/commands`,
        sessionToken: owner11.sessionToken,
        body: {
          expectedRevision: 1,
          expectedCommandCount: index,
          commandId: `cmd_${command}`,
          command,
        },
      })).resolves.toMatchObject({ status: 200 });
    }
    await expect(handle({
      method: "POST",
      path: `/mock-sessions/${countSessionId}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 2,
        commandId: "cmd_over_count",
        command: "c",
      },
    })).resolves.toEqual({
      status: 409,
      body: {
        error: {
          code: "session_command_count_limit",
          message: "This mock draft reached its command limit. Finish or reset it before continuing.",
        },
      },
    });

    await expect(handle({
      method: "GET",
      path: "/mock-sessions",
      sessionToken: owner11.sessionToken,
      query: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
      },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSessions: expect.arrayContaining([
          expect.objectContaining({
            id: bytesSessionId,
            commandLog: [expect.objectContaining({ id: "cmd_utf8" })],
          }),
          expect.objectContaining({
            id: countSessionId,
            commandLog: [
              expect.objectContaining({ id: "cmd_a" }),
              expect.objectContaining({ id: "cmd_b" }),
            ],
          }),
        ]),
      },
    });
  });
});
