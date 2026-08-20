import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { carouselSlides } from "./carouselSlides";
import { LandingCarousel } from "./LandingCarousel";

const placements = (): readonly (string | null)[] =>
  screen.getAllByRole("figure").map(card => card.getAttribute("data-placement"));

const clickForward = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Show the next screen" }));
};

describe("LandingCarousel", () => {
  it("opens with the second still in the middle and one still on each side", () => {
    render(<LandingCarousel />);

    expect(placements()).toEqual(["previous", "center", "next", "far-next", "far-next"]);
  });

  it("moves the next still into the middle and pushes the first one off the page", async () => {
    render(<LandingCarousel />);

    await clickForward();

    expect(placements()).toEqual(["far-previous", "previous", "center", "next", "far-next"]);
  });

  it("walks back again", async () => {
    render(<LandingCarousel />);

    await clickForward();
    await userEvent.click(screen.getByRole("button", { name: "Show the previous screen" }));

    expect(placements()).toEqual(["previous", "center", "next", "far-next", "far-next"]);
  });

  it("stops at both ends so the middle still always keeps a neighbour", async () => {
    render(<LandingCarousel />);
    const back = screen.getByRole("button", { name: "Show the previous screen" });
    const forward = screen.getByRole("button", { name: "Show the next screen" });

    expect(back).toBeDisabled();

    await clickForward();
    await clickForward();

    expect(forward).toBeDisabled();
    expect(back).toBeEnabled();
  });

  it("moves two cards when both clicks land before the page redraws", () => {
    render(<LandingCarousel />);
    const forward = screen.getByRole("button", { name: "Show the next screen" });

    // Two native clicks in one tick, the way an impatient thumb sends them.
    act(() => {
      forward.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      forward.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(placements()).toEqual(["far-previous", "far-previous", "previous", "center", "next"]);
  });

  it("describes every still for people who cannot see them", () => {
    render(<LandingCarousel />);

    expect(screen.getAllByRole("img").map(image => image.getAttribute("alt")))
      .toEqual(carouselSlides.map(slide => slide.alt));
  });
});
