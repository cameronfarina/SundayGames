import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { passwordRequirements } from "../../model/passwordPolicy";
import { PasswordGuidance } from "./PasswordGuidance";

describe("PasswordGuidance", () => {
  it("states the password minimum", () => {
    render(<PasswordGuidance id="password-guidance" />);

    expect(screen.getByText(passwordRequirements)).toHaveAttribute("id", "password-guidance");
  });
});
