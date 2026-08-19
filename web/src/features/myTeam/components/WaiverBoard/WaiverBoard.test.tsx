import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { InSeasonTeam } from "../../api/inSeasonSchema";
import { inSeasonTeam } from "../../api/inSeason.fixture";
import { WaiverBoard } from "./WaiverBoard";

describe("WaiverBoard", () => {
  it("frames the pre-season list honestly and names the ownership cut", () => {
    render(<WaiverBoard team={inSeasonTeam} />);

    expect(screen.getByText("Widely available players")).toBeVisible();
    expect(screen.getByText(/FantasyPros publishes waiver rankings once the season starts/u))
      .toBeVisible();
    expect(screen.getByText(/owned in under 50% of ESPN leagues/u)).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Rest-of-season rank" })).toBeVisible();
  });

  it("shows the rank, tier, ownership share, and an absent projection", () => {
    render(<WaiverBoard team={inSeasonTeam} />);

    const shough = screen.getByRole("row", { name: /Tyler Shough/u });
    expect(shough).toHaveTextContent("#125");
    expect(shough).toHaveTextContent("Tier 12");
    expect(shough).toHaveTextContent("41%");
    expect(shough).toHaveTextContent("14.2");
    expect(shough).toHaveTextContent("Week 11");
    expect(screen.getByRole("row", { name: /Jalen Coker/u })).toHaveTextContent("—");
  });

  it("filters to one position and back to all", async () => {
    const user = userEvent.setup();
    render(<WaiverBoard team={inSeasonTeam} />);

    await user.click(screen.getByRole("button", { name: "QB" }));
    expect(screen.getByRole("row", { name: /Tyler Shough/u })).toBeVisible();
    expect(screen.queryByRole("row", { name: /Jalen Coker/u })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QB" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByRole("row", { name: /Jalen Coker/u })).toBeVisible();
  });

  it("switches to the waiver rankings once FantasyPros publishes them", () => {
    render(<WaiverBoard team={{
      ...inSeasonTeam,
      waivers: {
        source: "waiver_rankings",
        players: [{
          playerId: "draft-player:jalen coker",
          playerName: "Jalen Coker",
          position: "WR",
          waiverRank: 1,
          ownedEspn: 37,
        }],
      },
    }} />);

    expect(screen.getByText("FantasyPros waiver rankings")).toBeVisible();
    expect(screen.getByText(/limited to players nobody in your league rosters/u)).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Waiver rank" })).toBeVisible();
    expect(screen.getByRole("row", { name: /Jalen Coker/u })).toHaveTextContent("#1");
  });

  it("does not invent a waiver rank that FantasyPros left out", () => {
    render(<WaiverBoard team={{
      ...inSeasonTeam,
      waivers: {
        source: "waiver_rankings",
        players: [{
          playerId: "draft-player:jalen coker",
          playerName: "Jalen Coker",
          position: "WR",
        }],
      },
    }} />);

    expect(screen.getByRole("row", { name: /Jalen Coker/u })).toHaveTextContent("Not ranked");
  });

  it("says when nothing is available and when FantasyPros is dark", () => {
    const empty: InSeasonTeam["waivers"] = {
      source: "widely_available",
      ownershipThreshold: 50,
      players: [],
    };
    const { unmount } = render(<WaiverBoard team={{ ...inSeasonTeam, waivers: empty }} />);
    expect(screen.getByText("No unrostered player has a FantasyPros ranking yet.")).toBeVisible();
    unmount();

    render(<WaiverBoard team={{ ...inSeasonTeam, configured: false, waivers: empty }} />);
    expect(screen.getByText("FantasyPros is not connected, so there are no suggestions to show."))
      .toBeVisible();
  });

  it("falls back to a zero threshold the payload did not send", () => {
    render(<WaiverBoard team={{
      ...inSeasonTeam,
      waivers: { source: "widely_available", players: [] },
    }} />);

    expect(screen.getByText(/owned in under 0% of ESPN leagues/u)).toBeVisible();
  });
});
