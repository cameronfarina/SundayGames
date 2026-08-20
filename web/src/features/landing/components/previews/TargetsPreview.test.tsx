import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TargetsPreview } from "./TargetsPreview";

describe("TargetsPreview", () => {
  it("lists each target with the most the viewer will pay for them", () => {
    render(<TargetsPreview />);

    expect(screen.getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "Jahmyr GibbsRBMaximum bid$64SaveRemove Jahmyr Gibbs",
      "Puka NacuaWRMaximum bid$61SaveRemove Puka Nacua",
      "Trey McBrideTEMaximum bid$34SaveRemove Trey McBride",
    ]);
  });

  it("draws attention to the bid the viewer just set", () => {
    render(<TargetsPreview />);

    expect(screen.getByText("$61")).toHaveClass("targets-preview__money--focused");
    expect(screen.getByText("$34")).not.toHaveClass("targets-preview__money--focused");
  });
});
