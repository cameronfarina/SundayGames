import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FantasyProsCredit } from "./FantasyProsCredit";

describe("FantasyProsCredit", () => {
  it("always credits FantasyPros", () => {
    render(<FantasyProsCredit />);
    expect(screen.getByText("Data by FantasyPros")).toBeVisible();
  });

  it("adds the sync time when one is known", () => {
    render(<FantasyProsCredit updatedAt="2026-09-17T09:00:00.000Z" />);
    expect(screen.getByText(/^Data by FantasyPros · Synced /u)).toBeVisible();
  });

  it("leaves out an unreadable sync time", () => {
    render(<FantasyProsCredit updatedAt="not a date" />);
    expect(screen.getByText("Data by FantasyPros")).toBeVisible();
  });
});
