import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { discoveredLeaguesFixture } from "../../api/leagueConnections.fixture";
import { discoveredLeagueKey, type LeagueImportStates } from "../../lib/discoveredLeagueState";
import { DiscoveredLeagueList } from "./DiscoveredLeagueList";

const leagues = discoveredLeaguesFixture.leagues;
const comrades = leagues[1] ?? { providerLeagueId: "", name: "", season: "", teamCount: 0 };

const noStates: LeagueImportStates = {};

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const renderList = (
  overrides: Partial<Parameters<typeof DiscoveredLeagueList>[0]> = {},
) => {
  const utils = {
    leagues,
    onImport: vi.fn(),
    onImportAll: vi.fn(),
    running: false,
    states: noStates,
    ...overrides,
  };
  render(<MemoryRouter><DiscoveredLeagueList {...utils} /></MemoryRouter>);
  return utils;
};

describe("DiscoveredLeagueList", () => {
  it("renders nothing before a search has returned", () => {
    const { container } = render(<MemoryRouter><DiscoveredLeagueList
      leagues={[]}
      onImport={vi.fn()}
      onImportAll={vi.fn()}
      running={false}
      states={{}}
    /></MemoryRouter>);

    expect(container).toBeEmptyDOMElement();
  });

  it("names each league in its button so the choice is unambiguous", async () => {
    const user = userEvent.setup();
    const utils = renderList();

    expect(screen.getByText("2026 season · 12 teams")).toBeVisible();
    expect(screen.getAllByText("Ready to import")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Connect and import Comrades League" }));

    expect(utils.onImport).toHaveBeenCalledWith(comrades);
  });

  it("imports the whole account in one press", async () => {
    const user = userEvent.setup();
    const utils = renderList();

    await user.click(screen.getByRole("button", { name: "Import all 2 leagues" }));

    expect(utils.onImportAll).toHaveBeenCalledOnce();
  });

  it("does not show an account-wide import control for one league", () => {
    renderList({ leagues: [comrades] });

    expect(screen.queryByRole("button", { name: /Import all/u })).not.toBeInTheDocument();
  });

  it("stops every button while an import is running", () => {
    renderList({ running: true });

    expect(screen.getByRole("button", { name: "Import all 2 leagues" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connect and import Comrades League" }))
      .toBeDisabled();
  });

  it("says which league is being built right now", () => {
    renderList({ states: { [discoveredLeagueKey(comrades)]: { status: "importing" } } });

    expect(screen.getByText("Building your league...")).toBeVisible();
    expect(screen.getByRole("button", { name: "Importing..." })).toBeDisabled();
  });

  it("lists every reason an import was refused and offers a retry", () => {
    renderList({
      states: {
        [discoveredLeagueKey(comrades)]: {
          issues: ["ESPN roster slot HC is not supported."],
          message: "This league needs a look first.",
          status: "error",
        },
      },
    });

    expect(screen.getByText("This league needs a look first.")).toBeVisible();
    expect(screen.getByText("ESPN roster slot HC is not supported.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry Comrades League" })).toBeVisible();
  });

  it("asks for missing draft settings instead of offering a useless retry", async () => {
    const user = userEvent.setup();
    const utils = renderList({
      leagues: [comrades],
      states: {
        [discoveredLeagueKey(comrades)]: {
          draftSetup: { auctionBudgetDollars: 200, minimumBidDollars: 1, snakeRounds: 16 },
          issues: ["ESPN did not include this league's draft format."],
          message: "Choose the draft format to finish importing this league.",
          status: "error",
        },
      },
    });

    expect(screen.queryByRole("button", { name: /Retry/u })).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Draft format" }));
    await user.click(screen.getByRole("option", { name: "Auction" }));
    await user.click(screen.getByRole("button", { name: "Finish import" }));

    expect(utils.onImport).toHaveBeenCalledWith(comrades, {
      type: "auction",
      budgetDollars: 200,
      minimumBidDollars: 1,
    });
  });

  it("sends a newly imported league to team selection", () => {
    renderList({
      states: {
        [discoveredLeagueKey(comrades)]: { leagueSlug: "comrades-league", status: "imported" },
      },
    });

    expect(screen.getByRole("link", { name: "Select team" }))
      .toHaveAttribute("href", "/leagues/comrades-league#claim-your-team");
    expect(screen.queryByRole("button", { name: "Connect and import Comrades League" }))
      .not.toBeInTheDocument();
  });
});
