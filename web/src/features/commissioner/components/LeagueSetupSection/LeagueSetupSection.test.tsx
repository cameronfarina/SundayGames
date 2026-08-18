import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, requestPath, snakeSeason } from "../../test/commissionerFixtures";
import { LeagueSetupSection } from "./LeagueSetupSection";

const readyImport = { status: "ready", blockers: [], records: [{
  sourceRowNumber: 2, ownerDisplayName: "Owner11", teamDisplayName: "Short King", role: "member",
}] };

const renderSection = (fetcher: PlatformFetch, snake = false) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient();
  client.setQueryData(seasonQueryKeys.onboarding(), { leagues: [] });
  client.setQueryData(seasonQueryKeys.leagueSeason(auctionSeason.id), { season: auctionSeason });
  client.setQueryData(seasonQueryKeys.seasonTeam(auctionSeason.id), { season: auctionSeason });
  const view = render(<QueryClientProvider client={client}>
    <LeagueSetupSection keepers={[]} season={snake ? snakeSeason : auctionSeason} />
  </QueryClientProvider>);
  return { ...view, client };
};

describe("LeagueSetupSection", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("disables apply until a manager or team name changes", async () => {
    renderSection(vi.fn());
    const apply = screen.getByRole("button", { name: "Apply changes" });
    expect(apply).toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText("Manager 1"), "x");
    expect(apply).toBeEnabled();
  });

  it("applies team changes directly without a preview step", async () => {
    const respond: PlatformFetch = input => {
      if (!requestPath(input).endsWith("apply")) throw new Error("Only the apply endpoint should be called.");
      return Promise.resolve(jsonResponse({
        season: auctionSeason, import: readyImport, invitations: [], invitationFailures: [],
      }, 207));
    };
    const fetcher = vi.fn(respond);
    const { client } = renderSection(fetcher);
    const user = userEvent.setup();
    expect(screen.queryByRole("button", { name: "Preview changes" })).not.toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "Apply changes" });
    expect(apply).toBeDisabled();
    await user.type(screen.getByLabelText("Manager 1"), "x");
    expect(apply).toBeEnabled();
    await user.click(apply);
    expect(await screen.findByText("League teams saved.")).toBeVisible();
    expect(client.getQueryState(seasonQueryKeys.onboarding())?.isInvalidated).toBe(true);
    expect(client.getQueryState(seasonQueryKeys.leagueSeason(auctionSeason.id))?.isInvalidated).toBe(true);
    expect(client.getQueryState(seasonQueryKeys.seasonTeam(auctionSeason.id))?.isInvalidated).toBe(true);
  });

  it("shows row blockers from a blocked apply, resets them on edit, and shows snake details", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "league_setup_import_blocked", message: "Resolve league setup import blockers before applying." },
      import: {
        status: "blocked", records: [], blockers: [
          { code: "blank_owner", message: "Owner is required.", rowNumber: 2 },
          { code: "team_count", message: "A team is missing." },
        ],
      },
    }, 400)));
    renderSection(fetcher, true);
    const user = userEvent.setup();
    expect(screen.getByText("16-round snake")).toBeVisible();
    await user.type(screen.getByLabelText("Manager 1"), "x");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText("Owner is required.")).toBeVisible();
    expect(screen.getByText("A team is missing.")).toBeVisible();
    expect(screen.queryByText("Resolve league setup import blockers before applying.")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Manager 1"), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sorts team rows into draft order", () => {
    const firstTeam = auctionSeason.teams[0];
    if (firstTeam === undefined) throw new Error("Expected an auction team fixture.");
    const secondTeam = {
      ...firstTeam, id: "team-2", ownerId: "owner-two", ownerDisplayName: "Alex",
      displayName: "Second Team", draftOrderPosition: 2,
    };
    const reordered = seasonSchema.parse({
      ...auctionSeason, teams: [secondTeam, firstTeam],
    });
    vi.stubGlobal("fetch", vi.fn());
    render(<QueryClientProvider client={new QueryClient()}>
      <LeagueSetupSection keepers={[]} season={reordered} />
    </QueryClientProvider>);
    expect(screen.getByLabelText("Manager 1")).toHaveValue("Owner11");
    expect(screen.getByLabelText("Team name 1")).toHaveValue("Short King");
    expect(screen.getByLabelText("Manager 2")).toHaveValue("Alex");
    expect(screen.getByLabelText("Team name 2")).toHaveValue("Second Team");
  });

  it("reports apply errors that carry no row blockers", async () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "setup_failed", message: "Could not apply." },
    }, 422))));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Manager 1"), "x");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not apply.");
  });

  it("labels the apply action while the request is pending", async () => {
    const user = userEvent.setup();
    renderSection(vi.fn(() => new Promise<Response>(() => undefined)));

    await user.type(screen.getByLabelText("Manager 1"), "x");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(screen.getByRole("button", { name: "Applying..." })).toBeDisabled();
  });

  it("lists only the rows that change, before anything is saved", async () => {
    const respond: PlatformFetch = input => Promise.resolve(
      requestPath(input).endsWith("preview")
        ? jsonResponse({
            import: readyImport,
            teamAssignments: [
              { sourceRowNumber: 2, ownerDisplayName: "Seth", teamDisplayName: "Alpha", effect: "kept" },
              {
                sourceRowNumber: 3, ownerDisplayName: "Tye", teamDisplayName: "Short King",
                effect: "renamed", previousOwnerDisplayName: "ty", previousTeamDisplayName: "Short King",
              },
              { sourceRowNumber: 4, ownerDisplayName: "Newcomer", teamDisplayName: "Bravo", effect: "new" },
            ],
          })
        : jsonResponse({ season: auctionSeason, import: readyImport, invitations: [], invitationFailures: [] }),
    );
    renderSection(vi.fn(respond));

    expect(await screen.findByText("Tye takes over ty's team (Short King), keeping its keepers."))
      .toBeVisible();
    expect(screen.getByText("Newcomer starts a new team with no keepers.")).toBeVisible();
    expect(screen.queryByText("Seth keeps their team.")).not.toBeInTheDocument();
  });

  it("says nothing at all when every row keeps its own team", async () => {
    renderSection(vi.fn((input: RequestInfo | URL) => Promise.resolve(
      requestPath(input).endsWith("preview")
        ? jsonResponse({
            import: readyImport,
            teamAssignments: [
              { sourceRowNumber: 2, ownerDisplayName: "Seth", teamDisplayName: "Alpha", effect: "kept" },
            ],
          })
        : jsonResponse({ season: auctionSeason, import: readyImport, invitations: [], invitationFailures: [] }),
    )));

    expect(await screen.findByRole("button", { name: "Apply changes" })).toBeDisabled();
    expect(screen.queryByRole("list", { name: "What these rows will do" })).not.toBeInTheDocument();
  });
});
