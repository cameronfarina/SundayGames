import { describe, expect, it, vi } from "vitest";
import {
  claimInvitationTeam,
  loadInvitationDetails,
  loadInvitationSession,
} from "./invitationApi";

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { status });

describe("invitation API", () => {
  it("loads public invitation details without leaking the token into request state", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      invitation: { id: "invite-1", seasonId: "season-1", kind: "league" },
      league: { id: "league-1", name: "Sunday Games", seasonYear: 2026 },
      teams: [],
    }));

    await expect(loadInvitationDetails("secret token", fetcher)).resolves.toMatchObject({
      league: { name: "Sunday Games" },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/invitations/details?token=secret+token",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("represents an unauthenticated session without throwing", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      error: { code: "authentication_required", message: "Sign in." },
    }, 401));

    await expect(loadInvitationSession(fetcher)).resolves.toEqual({ status: "signed-out" });
  });

  it("returns signed-in account details", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      account: { id: "user-1", email: "cam@example.com" },
    }));

    await expect(loadInvitationSession(fetcher)).resolves.toEqual({
      status: "signed-in",
      account: { id: "user-1", email: "cam@example.com" },
    });
  });

  it("claims an available team", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      membership: { userId: "user-1", leagueId: "league-1", role: "member", teamId: "team-1" },
    }));

    await expect(claimInvitationTeam({
      token: "token",
      teamId: "team-1",
    }, fetcher)).resolves.toMatchObject({ membership: { teamId: "team-1" } });
  });

  it("rejects unexpected session failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      error: { code: "service_unavailable", message: "Try again." },
    }, 503));

    await expect(loadInvitationSession(fetcher)).rejects.toMatchObject({ status: 503 });
  });
});
