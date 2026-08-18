import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordGuidance } from "./PasswordGuidance";

describe("PasswordGuidance", () => {
  it("states the password minimum", () => {
    render(<PasswordGuidance id="password-guidance" />);

    expect(screen.getByText(
      "Use at least 6 characters.",
    )).toHaveAttribute("id", "password-guidance");
  });
});
