import { afterEach, describe, expect, it, vi } from "vitest";
import { leagueConfig, ownerOrder } from "../../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../../src/platform/leagueSeason.js";
import { startPlatformWebFromEnv } from "../../src/platform/startPlatformWeb.js";
import {
  cleanupPlatformWebTest,
  createTemporaryDirectory,
  recordValue,
  sessionTokenFrom,
  stringValue,
  trackStartedProcess,
} from "./support.js";

afterEach(cleanupPlatformWebTest);

describe("platform web local live draft setup", () => {
  it("provides local live-draft setup data only in local-fixture mode", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const directory = await createTemporaryDirectory();
    const startedProcess = trackStartedProcess(await startPlatformWebFromEnv({
      HOST: "127.0.0.1",
      MOCKD_PLATFORM_DATA_FILE: `${directory}/platform.json`,
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: `${directory}/draft-tools`,
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    }));
    const handle = startedProcess.server.handler;

    await handle({
      method: "POST",
      path: "/accounts",
      body: { email: "league-owner@example.com", password: "secure owner password" },
    });
    const login = await handle({
      method: "POST",
      path: "/sessions",
      body: { email: "league-owner@example.com", password: "secure owner password" },
    });
    const loginBody = recordValue(login.body);
    const account = recordValue(loginBody.account);
    const accountId = stringValue(account.id);
    const sessionToken = sessionTokenFrom(login.headers?.["Set-Cookie"]);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Local fixture league",
      setupStatus: "published",
    });
    const ownerTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (ownerTeam === undefined) throw new Error("Expected local fixture owner team.");

    const published = await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken,
      body: {
        season,
        memberships: [{
          userId: accountId,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: ownerTeam.ownerId,
          teamId: ownerTeam.id,
        }],
      },
    });
    expect(published.status).toBe(200);

    const created = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken,
      body: {},
    });
    expect(created).toMatchObject({
      status: 201,
      body: {
        room: {
          seasonId: season.id,
          board: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua" }),
          ]),
        },
      },
    });
  });
});
