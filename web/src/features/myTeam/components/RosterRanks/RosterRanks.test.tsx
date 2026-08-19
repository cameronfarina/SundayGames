import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { inSeasonTeam } from "../../api/inSeason.fixture";
import { RosterRanks } from "./RosterRanks";

describe("RosterRanks", () => {
  it("shows both ranking horizons, the expert range, and the ECR change", () => {
    render(<RosterRanks team={inSeasonTeam} />);

    const gibbs = screen.getByRole("row", { name: /Jahmyr Gibbs/u });
    expect(gibbs).toHaveTextContent("Week 6");
    expect(gibbs).toHaveTextContent("#1");
    expect(gibbs).toHaveTextContent("#3");
    expect(gibbs).toHaveTextContent("RB2");
    expect(gibbs).toHaveTextContent("Tier 1");
    expect(gibbs).toHaveTextContent("1–2 (±0.4)");
    expect(gibbs).toHaveTextContent("+2 rising");
    expect(gibbs).toHaveTextContent("19.4");
    expect(gibbs).toHaveTextContent("280.5");
  });

  it("marks an unranked player as unranked instead of showing zeros", () => {
    render(<RosterRanks team={inSeasonTeam} />);

    const kicker = screen.getByRole("row", { name: /Cam Little/u });
    expect(kicker).toHaveTextContent("Not ranked");
    expect(kicker).not.toHaveTextContent("0.0");
    expect(screen.getByText("FantasyPros has no record for Cam Little.")).toBeVisible();
  });

  it("stays quiet when every player matched", () => {
    render(<RosterRanks team={{
      ...inSeasonTeam,
      players: inSeasonTeam.players.filter(player => player.fantasyProsPlayerId !== undefined),
    }} />);

    expect(screen.queryByText(/FantasyPros has no record for/u)).not.toBeInTheDocument();
  });
});
