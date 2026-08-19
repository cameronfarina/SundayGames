import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { connectionDetailFixture } from "../../api/leagueDetail.fixture";
import { LeagueSettingsSummary } from "./LeagueSettingsSummary";

const settings = connectionDetailFixture.league?.settings;

describe("LeagueSettingsSummary", () => {
  it("summarises the league in the vocabulary both providers share", () => {
    if (settings === undefined) throw new Error("Expected league settings.");
    render(<LeagueSettingsSummary settings={settings} />);

    expect(screen.getByText("QB, RB, WR, FLEX")).toBeVisible();
    expect(screen.getByText("Week 14")).toBeVisible();
    expect(screen.getByText("$100")).toBeVisible();
    expect(screen.getByText("Reception 1 · Passing TD 4")).toBeVisible();
    expect(screen.queryByText(/scoring rules/u)).not.toBeInTheDocument();
  });

  it("folds a provider's long tail of scoring keys behind one expander", () => {
    render(<LeagueSettingsSummary settings={{
      name: "Sunday Funday",
      season: "2026",
      teamCount: 12,
      rosterPositions: ["QB", "RB"],
      scoring: { fgm_40_49: 4, pass_td: 4, pts_allow_35p: -4, rec: 1 },
    }} />);

    expect(screen.getByText("Reception 1 · Passing TD 4")).toBeVisible();
    expect(screen.getByText("All 4 scoring rules")).toBeVisible();
    expect(screen.getByText("Fgm 40 49 4 · Passing TD 4 · Pts allow 35p -4 · Reception 1"))
      .toBeInTheDocument();
  });

  it("offers only the expander when no rule is one it can name", () => {
    render(<LeagueSettingsSummary settings={{
      name: "Odd league",
      season: "2026",
      teamCount: 8,
      rosterPositions: ["QB"],
      scoring: { blk_kick: 2 },
    }} />);

    expect(screen.getByText("All 1 scoring rule")).toBeVisible();
    expect(screen.getByText("Blk kick 2")).toBeInTheDocument();
  });

  it("omits rows a provider did not report", () => {
    render(<LeagueSettingsSummary settings={{
      name: "Bare league",
      season: "2026",
      teamCount: 10,
      rosterPositions: ["QB", "BN", "IR"],
      scoring: {},
    }} />);

    expect(screen.getByText("QB")).toBeVisible();
    expect(screen.queryByText("Playoff teams")).not.toBeInTheDocument();
    expect(screen.queryByText("Waiver budget")).not.toBeInTheDocument();
    expect(screen.queryByText("Scoring")).not.toBeInTheDocument();
  });
});
