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
    expect(screen.getByText("rec 1 · pass_td 4")).toBeVisible();
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
