import { describe, expect, it } from "vitest";
import { carouselSlides } from "./carouselSlides";

describe("carouselSlides", () => {
  it("carries enough stills for one in the middle and one on each side", () => {
    expect(carouselSlides.length).toBeGreaterThanOrEqual(3);
  });

  it("describes every still, because the picture carries the whole message", () => {
    for (const slide of carouselSlides) {
      expect(slide.alt.length).toBeGreaterThan(0);
      expect(slide.image.length).toBeGreaterThan(0);
    }
  });
});
