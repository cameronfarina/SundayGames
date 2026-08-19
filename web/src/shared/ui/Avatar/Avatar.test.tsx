import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";
import { avatarTone } from "./accountIdentity";

describe("Avatar", () => {
  it("shows the initials of the display name", () => {
    render(<Avatar displayName="Cam Farina" email="cam@example.com" seed="account-1" />);

    expect(screen.getByText("CF")).toBeVisible();
  });

  it("falls back to the email when there is no display name", () => {
    render(<Avatar email="cameron.farina@example.com" seed="account-1" />);

    expect(screen.getByText("CF")).toBeVisible();
  });

  it("paints the tone its seed picks and defaults to the middle size", () => {
    render(<Avatar email="cam@example.com" seed="account-1" />);

    expect(screen.getByText("C")).toHaveClass(
      `avatar--tone-${String(avatarTone("account-1"))}`,
      "avatar--md",
    );
  });

  it("takes a size and an extra class", () => {
    render(<Avatar className="extra" email="cam@example.com" seed="account-1" size="lg" />);

    expect(screen.getByText("C")).toHaveClass("avatar--lg", "extra");
  });

  it("hides itself from assistive technology, because the name is written out nearby", () => {
    render(<Avatar email="cam@example.com" seed="account-1" size="sm" />);

    expect(screen.getByText("C")).toHaveAttribute("aria-hidden", "true");
  });
});
