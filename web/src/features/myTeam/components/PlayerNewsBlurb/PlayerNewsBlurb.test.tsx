import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerNewsBlurb } from "./PlayerNewsBlurb";

const news = {
  headline: "Shough is expected to start again in Week 3",
  publishedAt: "2026-09-17T12:19:00.000Z",
  injury: false,
};

describe("PlayerNewsBlurb", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("shows the headline and when FantasyPros reported it", () => {
    vi.stubEnv("TZ", "America/New_York");
    render(<PlayerNewsBlurb news={news} />);

    expect(screen.getByText(news.headline)).toBeVisible();
    expect(screen.getByText("9/17 8:19am")).toBeVisible();
    expect(screen.queryByText("Injury")).not.toBeInTheDocument();
  });

  it("marks a report FantasyPros filed under its injury category", () => {
    render(<PlayerNewsBlurb news={{ ...news, injury: true }} />);

    expect(screen.getByText("Injury")).toBeVisible();
  });

  it("keeps the headline when the timestamp cannot be read", () => {
    render(<PlayerNewsBlurb news={{ ...news, publishedAt: "not-a-date" }} />);

    expect(screen.getByText(news.headline)).toBeVisible();
    expect(screen.queryByText(/^\d+\/\d+/u)).not.toBeInTheDocument();
  });

  it("renders nothing for a player FantasyPros published no news about", () => {
    const { container } = render(<PlayerNewsBlurb />);

    expect(container).toBeEmptyDOMElement();
  });
});
