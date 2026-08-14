import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField.js";

describe("TextField", () => {
  it("associates its label and hint with the input", async () => {
    const { unmount } = render(
      <TextField id="league-name" label="League name" hint="Shown to every manager." />,
    );

    const input = screen.getByRole("textbox", { name: "League name" });
    await userEvent.type(input, "Sunday Games");
    expect(input).toHaveValue("Sunday Games");
    expect(input).toHaveAccessibleDescription("Shown to every manager.");
    expect(input).toHaveAttribute("aria-invalid", "false");
    unmount();
  });

  it("announces an error instead of the hint", () => {
    const { unmount } = render(
      <TextField
        id="team-name"
        label="Team name"
        hint="Required"
        error="Enter a team name."
      />,
    );

    const input = screen.getByRole("textbox", { name: "Team name" });
    expect(input).toHaveAccessibleDescription("Enter a team name.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a team name.");
    unmount();
  });

  it("renders without supporting copy", () => {
    const { unmount } = render(<TextField id="manager" label="Manager" />);
    expect(screen.getByRole("textbox", { name: "Manager" })).not.toHaveAttribute("aria-describedby");
    unmount();
  });
});
