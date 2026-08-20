import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingStory } from "./LandingStory";

const renderStory = (mediaSide: "left" | "right") => {
  render(<LandingStory
    body="You set your own number."
    eyebrow="The board"
    heading="Argue with the market."
    media={<p>still</p>}
    mediaSide={mediaSide}
  />);

  return screen.getByRole("region", { name: "Argue with the market." });
};

describe("LandingStory", () => {
  it("puts the copy beside the still it explains", () => {
    renderStory("left");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Argue with the market.");
    expect(screen.getByText("The board")).toBeVisible();
    expect(screen.getByText("still")).toBeVisible();
  });

  it("can flip the still to the other side", () => {
    expect(renderStory("right")).toHaveClass("landing-story--media-right");
  });

  it("keeps the still on the reading side by default", () => {
    expect(renderStory("left")).toHaveClass("landing-story--media-left");
  });
});
