import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthShell } from "./AuthShell";

describe("AuthShell", () => {
  it("renders a semantic auth page without an optional footer", () => {
    render(
      <MemoryRouter>
        <AuthShell description="Secure access" title="Sign in"><form aria-label="Login" /></AuthShell>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sign in" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
