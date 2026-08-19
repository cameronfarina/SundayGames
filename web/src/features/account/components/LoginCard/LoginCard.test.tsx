import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { AuthAccount } from "../../../auth/api/authSchemas";
import { LoginCard } from "./LoginCard";

const account: AuthAccount = {
  createdAt: "2026-08-13T12:00:00.000Z",
  email: "cam@example.com",
  id: "account-cam",
  updatedAt: "2026-08-13T12:00:00.000Z",
};

const renderCard = (overrides: Partial<AuthAccount> = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginCard account={{ ...account, ...overrides }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("LoginCard", () => {
  it("shows the email a user signs in with and says it cannot be changed here", () => {
    renderCard();

    expect(screen.getByText("cam@example.com")).toBeVisible();
    expect(screen.getByText(/cannot be changed here/u)).toBeVisible();
  });

  it("calls out an unverified email", () => {
    renderCard();

    expect(screen.getByText("Not verified yet")).toBeVisible();
  });

  it("marks a verified email", () => {
    renderCard({ emailVerifiedAt: "2026-08-13T12:30:00.000Z" });

    expect(screen.getByText("Verified")).toBeVisible();
  });

  it("carries the password change form and warns that it signs you out", () => {
    renderCard();

    expect(screen.getByLabelText("Current password")).toBeVisible();
    expect(screen.getByLabelText("New password")).toBeVisible();
    expect(screen.getByText(/signs you out everywhere/u)).toBeVisible();
  });
});
