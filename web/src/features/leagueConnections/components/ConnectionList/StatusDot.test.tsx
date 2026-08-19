import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { leagueConnectionStatusSchema } from "../../api/leagueConnectionsSchema";
import { StatusDot } from "./StatusDot";

describe("StatusDot", () => {
  it("names the colour it is showing so it never reads as decoration", () => {
    render(<StatusDot status="needs_attention" />);

    const dot = screen.getByRole("button", {
      name: "Needs attention: This league needs something from you before it can sync again.",
    });
    expect(dot).toBeVisible();
    expect(dot).toHaveClass("status-dot__mark--warning");
  });

  it("is a real button, so a keyboard or a tap reaches the explanation too", () => {
    render(<StatusDot status="ok" />);

    const dot = screen.getByRole("button", { name: /^Synced:/u });
    expect(dot).toHaveAttribute("type", "button");
    expect(dot).toHaveAttribute("title", expect.stringContaining("up to date"));
  });

  it.each([
    ["ok", "status-dot__mark--success"],
    ["needs_attention", "status-dot__mark--warning"],
    ["error", "status-dot__mark--error"],
    ["pending", "status-dot__mark--info"],
  ])("gives %s its own colour", (status, expectedClass) => {
    render(<StatusDot status={leagueConnectionStatusSchema.parse(status)} />);

    expect(screen.getByRole("button")).toHaveClass(expectedClass);
  });
});
