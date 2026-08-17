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
    <LeagueSetupSection season={snake ? snakeSeason : auctionSeason} />
  </QueryClientProvider>);
  return { ...view, client };
};

describe("LeagueSetupSection", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("disables apply until the teams and managers text changes", async () => {
    renderSection(vi.fn());
    const apply = screen.getByRole("button", { name: "Apply changes" });
    expect(apply).toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText("Teams and managers"), "x");
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
    await user.type(screen.getByLabelText("Teams and managers"), "x");
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
    await user.type(screen.getByLabelText("Teams and managers"), "x");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText("Owner is required.")).toBeVisible();
    expect(screen.getByText("A team is missing.")).toBeVisible();
    expect(screen.queryByText("Resolve league setup import blockers before applying.")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Teams and managers"), "x");
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
      <LeagueSetupSection season={reordered} />
    </QueryClientProvider>);
    expect(screen.getByLabelText("Teams and managers")).toHaveValue(
      "owner,team,role\nOwner11,Short King,member\nAlex,Second Team,member",
    );
  });

  it("reports apply errors that carry no row blockers", async () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "setup_failed", message: "Could not apply." },
    }, 422))));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Teams and managers"), "x");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not apply.");
  });

  it("labels the apply action while the request is pending", async () => {
    const user = userEvent.setup();
    renderSection(vi.fn(() => new Promise<Response>(() => undefined)));

    await user.type(screen.getByLabelText("Teams and managers"), "x");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(screen.getByRole("button", { name: "Applying..." })).toBeDisabled();
  });
});
