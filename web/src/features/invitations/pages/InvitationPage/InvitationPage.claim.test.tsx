import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useOnboardingQuery } from "../../../../shared/api/onboarding/onboardingQuery";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import {
  invitationServer,
  renderInvitationPage,
  resetInvitationPages,
  useInvitationApi,
} from "./InvitationPage.testSupport";

const account = { id: "user-1", email: "user@example.com" };
const emptyOnboarding = { account, leagues: [] };
const claimedOnboarding = {
  account,
  leagues: [{
    canManageLeague: false,
    leagueId: "league-1",
    leagueName: "Sunday Games",
    liveDraft: null,
    membership: { role: "member", ownerId: "owner-1", teamId: "team-1" },
    readiness: { leagueSetup: "ready", liveDraft: "needs_attention", teamClaim: "ready" },
    seasonId: "season-1",
    seasonYear: 2026,
  }],
};

function CanonicalLeagueDestination() {
  const onboarding = useOnboardingQuery();
  if (onboarding.isPending) return <p>Loading league</p>;
  const league = onboarding.data?.leagues.find(({ seasonId }) => seasonId === "season-1");
  return <h1>{league?.leagueName ?? "League unavailable"}</h1>;
}

beforeAll(() => { invitationServer.listen({ onUnhandledRequest: "error" }); });
afterEach(() => {
  resetInvitationPages();
  invitationServer.resetHandlers();
});
afterAll(() => { invitationServer.close(); });

describe("InvitationPage claim cache", () => {
  it("refreshes canonical onboarding once before opening the claimed league", async () => {
    let claimed = false;
    let onboardingRequests = 0;
    useInvitationApi(true);
    invitationServer.use(
      http.get("/onboarding", () => {
        onboardingRequests += 1;
        return HttpResponse.json(claimed ? claimedOnboarding : emptyOnboarding);
      }),
      http.post("/invitations/claim", () => {
        claimed = true;
        return HttpResponse.json({
          membership: {
            userId: "user-1", leagueId: "league-1", role: "member",
            ownerId: "owner-1", teamId: "team-1",
          },
        });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(seasonQueryKeys.onboarding(), emptyOnboarding);
    renderInvitationPage("/invite?token=secret", {
      destination: <CanonicalLeagueDestination />,
      queryClient,
    });
    const user = userEvent.setup();

    await waitFor(() => { expect(onboardingRequests).toBe(1); });
    await user.click(await screen.findByRole("button", { name: "Join as Short King" }));

    expect(await screen.findByRole("heading", { name: "Sunday Games" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "League unavailable" })).not.toBeInTheDocument();
    expect(onboardingRequests).toBe(2);
  });
});
