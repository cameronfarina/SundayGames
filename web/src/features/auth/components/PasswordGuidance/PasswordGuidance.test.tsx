import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordGuidance } from "./PasswordGuidance";

describe("PasswordGuidance", () => {
  it("explains the password requirement as a memorable passphrase", () => {
    render(<PasswordGuidance id="password-guidance" />);

    expect(screen.getByText(
      "Use at least 15 characters. A passphrase of 4 memorable words works well.",
    )).toHaveAttribute("id", "password-guidance");
  });
});
