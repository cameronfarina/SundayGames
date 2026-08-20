import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectPreview } from "./ConnectPreview";

describe("ConnectPreview", () => {
  it("offers the platforms a league can actually be read from", () => {
    render(<ConnectPreview />);

    expect(screen.getByText("Sleeper")).toBeVisible();
    expect(screen.getByText("ESPN")).toBeVisible();
    expect(screen.queryByText("Yahoo")).toBeNull();
  });

  it("shows the leagues a username turns up", () => {
    render(<ConnectPreview />);

    expect(screen.getByText("Sunday Funday")).toBeVisible();
    expect(screen.getByRole("listitem", { current: true })).toHaveTextContent("Sleeper");
  });
});
