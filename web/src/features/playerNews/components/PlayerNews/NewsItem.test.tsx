import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playerNewsFeedFixture } from "../../api/playerNews.fixture";
import { NewsItem } from "./NewsItem";

const fixtureItem = (index: number) => {
  const item = playerNewsFeedFixture.items[index];
  if (item === undefined) throw new Error("Expected a news fixture.");
  return item;
};

describe("NewsItem", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("shows the player, the headline, the note, and a concise timestamp", async () => {
    vi.stubEnv("TZ", "America/New_York");
    const onToggleFollow = vi.fn();
    render(<NewsItem followed={false} item={fixtureItem(0)} onToggleFollow={onToggleFollow} />);
    expect(screen.getByText("Ladd McConkey · WR · LAC")).toBeVisible();
    expect(screen.getByText(/8\/16 9:30am/u)).toBeVisible();
    // The card still carries no auction line and no outbound link.
    expect(screen.queryByText(/\$18 live \/ \$22 max/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add Ladd McConkey to my players" }));
    expect(onToggleFollow).toHaveBeenCalledWith("Ladd McConkey");
  });

  it("names the reporting source on every card", () => {
    render(<NewsItem followed={false} item={fixtureItem(0)} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("FantasyPros")).toBeVisible();
  });

  it("lists every label the provider applied, most actionable first", () => {
    render(<NewsItem followed={false} item={fixtureItem(0)} onToggleFollow={vi.fn()} />);
    const labels = within(screen.getByRole("list", { name: "Categories for Ladd McConkey" }));
    expect(labels.getAllByRole("listitem").map(label => label.textContent))
      .toEqual(["Role", "Commentary", "News"]);
  });

  it("marks an injury label so it reads apart from the rest", () => {
    const item = fixtureItem(0);
    render(<NewsItem
      followed={false}
      item={{ ...item, categories: ["Commentary", "Injury"], category: "Injury" }}
      onToggleFollow={vi.fn()}
    />);
    expect(screen.getByText("Injury")).toHaveClass("player-news-item__label--injury");
    expect(screen.getByText("Commentary")).not.toHaveClass("player-news-item__label--injury");
  });

  it("still shows one label for a provider that categorises nothing", () => {
    render(<NewsItem followed={false} item={fixtureItem(1)} onToggleFollow={vi.fn()} />);
    const labels = within(screen.getByRole("list", { name: "Categories for De'Von Achane" }));
    expect(labels.getAllByRole("listitem").map(label => label.textContent)).toEqual(["Practice"]);
  });

  it("shows the analyst take as its own note when the provider ships one", () => {
    render(<NewsItem followed={false} item={fixtureItem(0)} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("Analyst take")).toBeVisible();
    expect(screen.getByText(/A bigger route share lifts his floor/u)).toBeVisible();
  });

  it("omits the analyst note entirely when there is none", () => {
    render(<NewsItem followed={false} item={fixtureItem(1)} onToggleFollow={vi.fn()} />);
    expect(screen.queryByText("Analyst take")).not.toBeInTheDocument();
  });

  it("handles provider evidence without player metadata, links, or valid dates", () => {
    const item = fixtureItem(1);
    render(<NewsItem followed item={{ ...item, fetchedAt: "not-a-date", player: "NFL", position: undefined }} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("NFL")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove NFL from my players" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    // An unreadable date drops the timestamp rather than printing "Invalid Date".
    expect(screen.queryByText(/\d+\/\d+ \d+:\d+[ap]m/u)).not.toBeInTheDocument();
  });

  it("shows a position when the NFL team is unavailable", () => {
    render(<NewsItem followed={false} item={{ ...fixtureItem(0), teamAbbreviation: undefined }} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("Ladd McConkey · WR")).toBeVisible();
  });
});
