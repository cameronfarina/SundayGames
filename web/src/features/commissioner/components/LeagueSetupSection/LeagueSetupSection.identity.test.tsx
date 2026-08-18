import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, requestBody, requestPath, snakeSeason } from "../../test/commissionerFixtures";
import { LeagueSetupSection } from "./LeagueSetupSection";

const readyImport = { status: "ready", blockers: [], records: [] };

const firstTeam = auctionSeason.teams[0];
if (firstTeam === undefined) throw new Error("Expected an auction team fixture.");

const twoTeams = seasonSchema.parse({
  ...auctionSeason,
  teams: [firstTeam, {
    ...firstTeam, id: "team-2", ownerId: "owner-two", ownerDisplayName: "Alex",
    displayName: "Second Team", draftOrderPosition: 2,
  }],
});

const chase = {
  teamId: "team-1", playerId: "jamarr-chase", playerName: "Ja'Marr Chase", position: "WR", price: 40,
};

const captureApplyBodies = (season: typeof auctionSeason) => {
  const bodies: string[] = [];
  const fetcher: PlatformFetch = (input, init) => {
    bodies.push(requestBody(init));
    return Promise.resolve(requestPath(input).endsWith("apply")
      ? jsonResponse({ season, import: readyImport, invitations: [], invitationFailures: [] })
      : jsonResponse({ import: readyImport, teamAssignments: [] }));
  };
  vi.stubGlobal("fetch", vi.fn(fetcher));
  render(<QueryClientProvider client={new QueryClient()}>
    <LeagueSetupSection keepers={[chase]} season={season} />
  </QueryClientProvider>);
  return bodies;
};

describe("LeagueSetupSection team identity", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("sends the team id with a renamed manager instead of matching on the new name", async () => {
    const bodies = captureApplyBodies(auctionSeason);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Manager 1"));
    await user.type(screen.getByLabelText("Manager 1"), "Tye");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(await screen.findByText("League teams saved.")).toBeVisible();
    expect(bodies.at(-1)).toContain("teamId,owner,team,role,draftOrder\\nteam-1,Tye,Short King,member,1");
  });

  it("sends a snake draft order edit and leaves auction rows as plain numbers", async () => {
    const bodies = captureApplyBodies(snakeSeason);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Draft order 1"));
    await user.type(screen.getByLabelText("Draft order 1"), "4");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(await screen.findByText("League teams saved.")).toBeVisible();
    expect(bodies.at(-1)).toContain("team-1,Owner11,Short King,member,4");
  });

  it("shows a plain pick number for an auction league", () => {
    captureApplyBodies(auctionSeason);

    expect(screen.queryByLabelText("Draft order 1")).not.toBeInTheDocument();
  });

  it("sends the team id with a renamed team as well as a renamed manager", async () => {
    const bodies = captureApplyBodies(auctionSeason);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Team name 1"));
    await user.type(screen.getByLabelText("Team name 1"), "Tall King");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(await screen.findByText("League teams saved.")).toBeVisible();
    expect(bodies.at(-1)).toContain("team-1,Owner11,Tall King,member");
  });


  it("puts each keeper on the row of the team that holds it", () => {
    captureApplyBodies(twoTeams);

    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Ja'Marr Chase $40");
    expect(screen.getAllByRole("listitem")[1]).not.toHaveTextContent("Ja'Marr Chase");
  });

  it("offers no way to add or remove a team, because the league size is fixed", () => {
    captureApplyBodies(twoTeams);

    expect(screen.getAllByLabelText(/^Manager \d+$/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /add team/iu })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove team/iu })).not.toBeInTheDocument();
  });
});
