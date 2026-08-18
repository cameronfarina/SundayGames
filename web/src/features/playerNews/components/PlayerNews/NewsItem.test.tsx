import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playerNewsFeedFixture } from "../../api/playerNews.fixture";
import { NewsItem } from "./NewsItem";

describe("NewsItem", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("shows only the player, the headline, the note, and a concise timestamp", async () => {
    vi.stubEnv("TZ", "America/New_York");
    const item = playerNewsFeedFixture.items[0];
    if (item === undefined) throw new Error("Expected a news fixture.");
    const onToggleFollow = vi.fn();
    render(<NewsItem followed={false} item={item} onToggleFollow={onToggleFollow} />);
    expect(screen.getByText("Ladd McConkey · WR · LAC")).toBeVisible();
    expect(screen.getByText(/8\/16 9:30am/u)).toBeVisible();
    // The card carries no category, auction line, provider, or source link.
    expect(screen.queryByText(/\$18 live \/ \$22 max/u)).not.toBeInTheDocument();
    expect(screen.queryByText(item.category)).not.toBeInTheDocument();
    expect(screen.queryByText(item.source.provider)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add Ladd McConkey to my players" }));
    expect(onToggleFollow).toHaveBeenCalledWith("Ladd McConkey");
  });

  it("handles provider evidence without player metadata, links, or valid dates", () => {
    const item = playerNewsFeedFixture.items[1];
    if (item === undefined) throw new Error("Expected a news fixture.");
    render(<NewsItem followed item={{ ...item, fetchedAt: "not-a-date", player: "NFL", position: undefined }} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("NFL")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove NFL from my players" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    // An unreadable date drops the timestamp rather than printing "Invalid Date".
    expect(screen.queryByText(/\d+\/\d+ \d+:\d+[ap]m/u)).not.toBeInTheDocument();
  });

  it("shows a position when the NFL team is unavailable", () => {
    const item = playerNewsFeedFixture.items[0];
    if (item === undefined) throw new Error("Expected a news fixture.");
    render(<NewsItem followed={false} item={{ ...item, teamAbbreviation: undefined }} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("Ladd McConkey · WR")).toBeVisible();
  });
});
