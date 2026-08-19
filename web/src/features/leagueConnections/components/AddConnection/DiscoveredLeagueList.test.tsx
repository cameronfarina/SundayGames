import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { discoveredLeaguesFixture } from "../../api/leagueConnections.fixture";
import { DiscoveredLeagueList } from "./DiscoveredLeagueList";

describe("DiscoveredLeagueList", () => {
  it("renders nothing before a search has returned", () => {
    const { container } = render(<DiscoveredLeagueList
      leagues={[]}
      onConnect={vi.fn()}
      pending={false}
    />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names each league in its connect button so the choice is unambiguous", async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    render(<DiscoveredLeagueList
      leagues={discoveredLeaguesFixture.leagues}
      onConnect={onConnect}
      pending={false}
    />);

    expect(screen.getByText("2026 season · 12 teams")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Connect Comrades League" }));

    expect(onConnect).toHaveBeenCalledWith(discoveredLeaguesFixture.leagues[1]);
  });

  it("stops a second connect while one is already saving", () => {
    render(<DiscoveredLeagueList
      leagues={discoveredLeaguesFixture.leagues}
      onConnect={vi.fn()}
      pending
    />);

    expect(screen.getByRole("button", { name: "Connect Comrades League" })).toBeDisabled();
  });
});
