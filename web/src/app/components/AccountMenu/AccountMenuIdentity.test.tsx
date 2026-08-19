import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountMenuIdentity } from "./AccountMenuIdentity";

describe("AccountMenuIdentity", () => {
  it("shows the display name above the email", () => {
    render(<AccountMenuIdentity
      account={{ displayName: "Cam Farina", email: "cam@example.com", id: "account-1" }}
    />);

    expect(screen.getByText("Cam Farina")).toBeVisible();
    expect(screen.getByText("cam@example.com")).toBeVisible();
    expect(screen.getByText("CF")).toBeVisible();
  });

  it("leads with the email and writes it once when there is no display name", () => {
    render(<AccountMenuIdentity account={{ email: "cam@example.com", id: "account-1" }} />);

    expect(screen.getAllByText("cam@example.com")).toHaveLength(1);
  });

  it("ignores a display name that is only whitespace", () => {
    render(<AccountMenuIdentity
      account={{ displayName: "  ", email: "cam@example.com", id: "account-1" }}
    />);

    expect(screen.getAllByText("cam@example.com")).toHaveLength(1);
  });
});
