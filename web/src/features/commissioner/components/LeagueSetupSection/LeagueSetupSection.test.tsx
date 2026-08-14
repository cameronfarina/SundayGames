import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, requestPath, snakeSeason } from "../../test/commissionerFixtures";
import { LeagueSetupSection } from "./LeagueSetupSection";

const readyImport = { status: "ready", blockers: [], records: [{
  sourceRowNumber: 2, ownerDisplayName: "Cam", teamDisplayName: "Short King", role: "member",
}] };

const renderSection = (fetcher: PlatformFetch, snake = false) => {
  vi.stubGlobal("fetch", fetcher);
  return render(<QueryClientProvider client={new QueryClient()}>
    <LeagueSetupSection season={snake ? snakeSeason : auctionSeason} />
  </QueryClientProvider>);
};

describe("LeagueSetupSection", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("requires a successful preview before applying team changes", async () => {
    const respond: PlatformFetch = input => Promise.resolve(
      requestPath(input).endsWith("preview")
        ? jsonResponse({ import: readyImport })
        : jsonResponse({
            season: auctionSeason, import: readyImport, invitations: [], invitationFailures: [],
          }, 207),
    );
    const fetcher = vi.fn(respond);
    renderSection(fetcher);
    const user = userEvent.setup();
    const apply = screen.getByRole("button", { name: "Apply changes" });
    expect(apply).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Preview changes" }));
    expect(await screen.findByText("Ready to apply 1 teams.")).toBeVisible();
    await user.click(apply);
    expect(await screen.findByText("League teams saved.")).toBeVisible();
  });

  it("shows blocked previews, reset behavior, errors, and snake details", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({ import: {
      status: "blocked", records: [], blockers: [
        { code: "blank_owner", message: "Owner is required.", rowNumber: 2 },
        { code: "team_count", message: "A team is missing." },
      ],
    } })));
    renderSection(fetcher, true);
    const user = userEvent.setup();
    expect(screen.getByText("16-round snake")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Preview changes" }));
    expect(await screen.findByText("Owner is required.")).toBeVisible();
    expect(screen.getByText("A team is missing.")).toBeVisible();
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
      "owner,team,role\nCam,Short King,member\nAlex,Second Team,member",
    );
  });

  it("reports preview and apply errors", async () => {
    let requests = 0;
    const respond: PlatformFetch = input => {
      requests += 1;
      if (requests === 1) return Promise.resolve(jsonResponse({ import: readyImport }));
      return Promise.resolve(jsonResponse({
        error: { code: "setup_failed", message: `Could not ${requestPath(input).includes("apply") ? "apply" : "preview"}.` },
      }, 422));
    };
    const view = renderSection(vi.fn(respond));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Preview changes" }));
    await user.click(await screen.findByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not apply.");
    view.unmount();
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "preview_failed", message: "Could not preview." },
    }, 422))));
    await user.click(screen.getByRole("button", { name: "Preview changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not preview.");
  });
});
