import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { onboardingSchema } from "../../../../shared/api/onboarding/onboardingSchema";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, requestPath } from "../../test/commissionerFixtures";
import { CommissionerPage } from "./CommissionerPage";

const seasonFor = (id: string, leagueId: string, teamName: string, year: number) =>
  seasonSchema.parse({
    ...auctionSeason,
    id,
    leagueId,
    league: { ...auctionSeason.league, id: leagueId, name: teamName },
    seasonYear: year,
    teams: auctionSeason.teams.map(team => ({
      ...team,
      displayName: teamName,
      leagueSeasonId: id,
    })),
  });

const seasonA = seasonFor("season-a", "league-a", "Alpha", 2026);
const seasonB = seasonFor("season-b", "league-b", "Beta", 2027);
const onboarding = onboardingSchema.parse({
  account: { id: "account-user", email: "user@example.com" },
  leagues: [seasonA, seasonB].map(season => ({
    leagueId: season.leagueId,
    leagueName: season.league.name,
    leagueSlug: season.league.name.toLowerCase(),
    seasonId: season.id,
    seasonYear: season.seasonYear,
    membership: { role: "owner" },
    canManageLeague: true,
    readiness: { leagueSetup: "ready", teamClaim: "ready", liveDraft: "needs_attention" },
    liveDraft: null,
  })),
});

const renderWorkspace = () => {
  const applyRequests: { readonly body: string; readonly path: string }[] = [];
  const respond: PlatformFetch = (input, init) => {
    const path = requestPath(input);
    if (path === "/onboarding") return Promise.resolve(jsonResponse(onboarding));
    const selected = path.includes("season-b") ? seasonB : seasonA;
    if (path === `/seasons/${selected.id}`) {
      return Promise.resolve(jsonResponse({ season: selected, claimableTeams: [] }));
    }
    if (path === `/seasons/${selected.id}/keepers`) return Promise.resolve(jsonResponse({ keepers: [] }));
    if (path === `/invitations?seasonId=${selected.id}`) {
      return Promise.resolve(jsonResponse({ invitations: [], claimedTeamIds: [] }));
    }
    if (path.endsWith("/setup-import/apply")) {
      applyRequests.push({ body: typeof init?.body === "string" ? init.body : "", path });
      return Promise.resolve(jsonResponse({
        error: { code: "league_setup_import_blocked", message: "Resolve league setup import blockers before applying." },
        import: { blockers: [{ code: "test", message: "Test blocker." }], records: [], status: "blocked" },
      }, 400));
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  vi.stubGlobal("fetch", vi.fn(respond));
  const router = createMemoryRouter(
    [{ path: "/commissioner", element: <CommissionerPage /> }],
    { initialEntries: ["/commissioner?seasonId=season-a"] },
  );
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>);
  return { applyRequests, router };
};

describe("CommissionerPage season state", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("discards every staged commissioner edit when the active season changes", async () => {
    const { applyRequests, router } = renderWorkspace();
    const user = userEvent.setup();
    expect(await screen.findByText("Alpha · 2026")).toBeVisible();
    await user.clear(screen.getByLabelText("Teams and managers"));
    await user.type(screen.getByLabelText("Teams and managers"), "A staged rows");
    await user.type(screen.getByLabelText("Keeper command"), "A keeper");
    await user.upload(screen.getByLabelText("Choose historical draft files"), new File(["a"], "alpha.csv"));
    await user.click(screen.getByLabelText("Replace an import for the same year"));
    await user.type(screen.getByLabelText("Draft date and time"), "2026-09-10T20:00");

    await router.navigate("/commissioner?seasonId=season-b");
    expect(await screen.findByText("Beta · 2027")).toBeVisible();
    expect(screen.getByLabelText("Teams and managers")).toHaveValue("owner,team,role\nOwner11,Beta,member");
    expect(screen.getByLabelText("Keeper command")).toHaveValue("");
    expect(screen.queryByText("alpha.csv")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Replace an import for the same year")).not.toBeChecked();
    expect(screen.getByLabelText("Draft date and time")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(applyRequests).toEqual([{
      body: JSON.stringify({ content: "owner,team,role\nOwner11,Beta,member" }),
      path: "/seasons/season-b/setup-import/apply",
    }]);

    await router.navigate("/commissioner?seasonId=season-a");
    expect(await screen.findByText("Alpha · 2026")).toBeVisible();
    expect(screen.getByLabelText("Teams and managers")).toHaveValue("owner,team,role\nOwner11,Alpha,member");
    expect(screen.getByLabelText("Keeper command")).toHaveValue("");
    expect(screen.queryByText("alpha.csv")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft date and time")).toHaveValue("");
  });
});
