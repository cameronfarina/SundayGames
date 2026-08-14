import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { authRoutes, verifyEmailLoader } from "./authRoutes";

const mountVerification = (entry: string) => {
  const router = createMemoryRouter(authRoutes, { initialEntries: [entry] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe("email verification route", () => {
  it("requests a new link when the URL has no verification token", async () => {
    mountVerification("/verify-email?email=cam%40example.com");

    expect(await screen.findByRole("textbox", { name: "Email" })).toHaveValue("cam@example.com");
    expect(screen.getByRole("button", { name: "Send verification link" })).toBeEnabled();
  });

  it("opens password setup for a mailbox verification token", async () => {
    mountVerification("/verify-email?token=mailbox-token&email=cam%40example.com");

    expect(await screen.findByLabelText("Choose password")).toBeEnabled();
    expect(screen.getByLabelText("Confirm password")).toBeEnabled();
  });

  it("accepts password setup without an email query parameter", async () => {
    mountVerification("/verify-email?token=mailbox-token");

    expect(await screen.findByLabelText("Choose password")).toBeEnabled();
  });

  it("returns typed request and setup outcomes", () => {
    const requestUrl = new URL("https://mockd.test/verify-email");
    const setupUrl = new URL("https://mockd.test/verify-email?token=mailbox-token");
    expect(verifyEmailLoader({
      context: {}, params: {}, pattern: "/verify-email",
      request: new Request(requestUrl), url: requestUrl,
    })).toEqual({ status: "request" });
    expect(verifyEmailLoader({
      context: {}, params: {}, pattern: "/verify-email",
      request: new Request(setupUrl), url: setupUrl,
    })).toEqual({ status: "setup", token: "mailbox-token" });
  });
});
