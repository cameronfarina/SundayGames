import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { sessionQueryKey } from "../../../features/auth/api/sessionQuery";
import { onboardingQueryOptions } from "../../../shared/api/onboarding/onboardingQuery";
import {
  onboardingLeagueSchema,
  type Onboarding,
  type OnboardingLeague,
} from "../../../shared/api/onboarding/onboardingSchema";
import { AccountMenu } from "./AccountMenu";

const cachedOnboarding: Onboarding = {
  account: { email: "example.user@example.com", id: "account-example" },
  leagues: [],
};

const league: OnboardingLeague = onboardingLeagueSchema.parse({
  canManageLeague: true,
  leagueId: "league-1",
  leagueName: "The Sunday Games",
  leagueSlug: "sunday-games",
  liveDraft: null,
  membership: { role: "owner" },
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId: "season-a",
  seasonYear: 2026,
});

const openMenu = async (canManageLeague: boolean) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(sessionQueryKey(), { private: "session" });
  queryClient.setQueryData(onboardingQueryOptions().queryKey, cachedOnboarding);
  const menu = <AccountMenu
    activeLeague={league}
    canManageLeague={canManageLeague}
    email="example.user@example.com"
    leagues={[league]}
    onLeagueChange={() => undefined}
  />;
  const router = createMemoryRouter([
    { path: "/practice", element: menu },
    { path: "/leagues/:slug/my-team", element: <h1>Team page</h1> },
    { path: "/connections", element: <h1>Connections page</h1> },
  ], { initialEntries: ["/practice"] });
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Account menu" }));
  return user;
};

describe("AccountMenu navigation", () => {
  it("carries every page a phone cannot show in the header", async () => {
    await openMenu(true);

    for (const label of ["Practice", "Player news", "League", "My team", "Commissioner"]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeVisible();
    }
  });

  it("leaves out the commissioner page for a manager who cannot run the league", async () => {
    await openMenu(false);

    expect(screen.getByRole("menuitem", { name: "My team" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Commissioner" })).not.toBeInTheDocument();
  });

  it("marks the page being viewed", async () => {
    await openMenu(true);

    expect(screen.getByRole("menuitem", { name: "Practice" }))
      .toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("menuitem", { name: "My team" }))
      .not.toHaveAttribute("aria-current");
  });

  it("opens the page a menu entry names", async () => {
    const user = await openMenu(false);

    await user.click(screen.getByRole("menuitem", { name: "My team" }));

    expect(await screen.findByRole("heading", { name: "Team page" })).toBeVisible();
  });

  it("reaches connected leagues from the account menu on every screen size", async () => {
    const user = await openMenu(false);

    const syncLeagues = screen.getByRole("menuitem", { name: "Sync leagues" });
    expect(syncLeagues).toBeVisible();
    await user.click(syncLeagues);

    expect(await screen.findByRole("heading", { name: "Connections page" })).toBeVisible();
  });
});
