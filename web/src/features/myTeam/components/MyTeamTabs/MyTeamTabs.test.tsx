import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MyTeamTabs } from "./MyTeamTabs";

describe("MyTeamTabs", () => {
  it("preserves the active season and identifies the current view", () => {
    render(<MemoryRouter><MyTeamTabs seasonId="season-2026" view="prep" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Draft prep" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Player news" })).toHaveAttribute(
      "href",
      "/my-team?view=news&seasonId=season-2026",
    );
  });

  it("builds a baseline link without an absent season", () => {
    render(<MemoryRouter><MyTeamTabs seasonId={undefined} view="team" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("href", "/my-team?view=team");
  });
});
