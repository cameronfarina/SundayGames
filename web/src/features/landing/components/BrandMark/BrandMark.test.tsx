import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("stays out of the reading order, because the name sits beside it in text", () => {
    render(<BrandMark size={30} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("graphics-document")).toBeNull();
  });
});
