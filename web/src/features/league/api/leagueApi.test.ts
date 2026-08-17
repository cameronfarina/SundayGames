import { describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import {
  claimLeagueTeam,
  loadLeagueSeason,
  loadSeasonKeepers,
} from "./leagueApi";

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { status });

describe("league API", () => {
  it("rejects malformed season data", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ season: { id: 3 } }));

    await expect(loadLeagueSeason("season 1", fetcher)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("loads a keeper list", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ keepers: [] }));

    await expect(loadSeasonKeepers("season/1", fetcher)).resolves.toEqual({ keepers: [] });
    expect(fetcher).toHaveBeenCalledWith("/seasons/season%2F1/keepers", expect.anything());
  });

  it("claims a team with its owner identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      membership: {
        userId: "user-1",
        leagueId: "league-1",
        role: "member",
        ownerId: "owner-1",
        teamId: "team-1",
      },
    }));

    await expect(claimLeagueTeam({
      seasonId: "season-1",
      ownerId: "owner-1",
      teamId: "team-1",
    }, fetcher)).resolves.toMatchObject({ membership: { teamId: "team-1" } });
    expect(fetcher).toHaveBeenCalledWith("/seasons/season-1/team-claims", expect.objectContaining({
      body: JSON.stringify({ ownerId: "owner-1", teamId: "team-1" }),
      method: "POST",
    }));
  });

  it("preserves platform authorization errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      error: { code: "membership_required", message: "Join this league first." },
    }, 403));

    await expect(loadLeagueSeason("season-1", fetcher)).rejects.toEqual(
      new PlatformApiError({
        body: { error: { code: "membership_required", message: "Join this league first." } },
        code: "membership_required",
        message: "Join this league first.",
        status: 403,
      }),
    );
  });
});
