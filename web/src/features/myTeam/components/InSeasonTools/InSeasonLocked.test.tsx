import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InSeasonLocked } from "./InSeasonLocked";

describe("InSeasonLocked", () => {
  it("explains what the lineup tab will do after the draft", () => {
    render(<InSeasonLocked view="lineup" />);

    expect(screen.getByRole("heading", { name: "Lineup help opens after your draft" })).toBeVisible();
    expect(screen.getByText(/flags any starter the experts rate behind your own bench/u)).toBeVisible();
  });

  it("explains what the waiver tab will do after the draft", () => {
    render(<InSeasonLocked view="waivers" />);

    expect(screen.getByRole("heading", { name: "Waiver wire opens after your draft" })).toBeVisible();
    expect(screen.getByText(/nobody in your league rosters/u)).toBeVisible();
  });
});
