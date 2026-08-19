import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerAdvisory } from "./PlayerAdvisory";
import type { LiveDraftAdvisoryPlayer } from "../../api/liveDraftAdvisorySchemas";

const player = (overrides: Partial<LiveDraftAdvisoryPlayer> = {}): LiveDraftAdvisoryPlayer => ({
  normalizedPlayerName: "Puka Nacua",
  rankEcr: 3,
  momentum: "steady",
  ...overrides,
});

describe("PlayerAdvisory", () => {
  it("shows a placeholder when FantasyPros does not rank the player", () => {
    render(<PlayerAdvisory advisory={undefined} />);

    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("shows the consensus rank and tier", () => {
    render(<PlayerAdvisory advisory={player({ tier: 2 })} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("omits the tier badge when FantasyPros reports no tier", () => {
    render(<PlayerAdvisory advisory={player()} />);

    expect(screen.queryByText(/^T\d+$/u)).not.toBeInTheDocument();
  });

  it("marks a riser with an accessible label", () => {
    render(<PlayerAdvisory advisory={player({ momentum: "rising", ecrDelta: 4 })} />);

    expect(screen.getByText("consensus rank up 4")).toBeInTheDocument();
    expect(screen.getByText("▲")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks a faller with an accessible label", () => {
    render(<PlayerAdvisory advisory={player({ momentum: "falling", ecrDelta: -6 })} />);

    expect(screen.getByText("consensus rank down 6")).toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("shows no movement marker for a steady rank", () => {
    render(<PlayerAdvisory advisory={player()} />);

    expect(screen.queryByText("▲")).not.toBeInTheDocument();
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });

  it("summarises the advisory in a hover title", () => {
    render(<PlayerAdvisory advisory={player({ positionRank: "WR2", tier: 1 })} />);

    expect(screen.getByTitle("Consensus rank 3 · WR2 · tier 1")).toBeInTheDocument();
  });
});
