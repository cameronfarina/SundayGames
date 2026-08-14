import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authRoutes } from "../../routes/authRoutes";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);
const Provider = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const mountRoute = (path: string) => {
  const router = createMemoryRouter(authRoutes, { initialEntries: [path] });
  render(<Provider><RouterProvider router={router} /></Provider>);
  return router;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("authentication recovery", () => {
  it("requests a password reset on Enter without revealing account existence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return jsonResponse({ accepted: true, message: "If an account exists, a reset link is on its way." }, 202);
    }));
    mountRoute("/forgot-password");
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "cam@example.com{Enter}");
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
  });

  it("shows password-reset request errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "auth_rate_limited", message: "Too many attempts. Try again later." },
    }, 429)));
    mountRoute("/forgot-password");
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "cam@example.com{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
  });

  it("explains a missing reset token", () => {
    mountRoute("/reset-password");
    expect(screen.getByRole("alert")).toHaveTextContent("missing its token");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("resets a password and returns to login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return jsonResponse({ reset: true });
    }));
    const navigation = mountRoute("/reset-password?token=reset-token");
    await userEvent.type(screen.getByLabelText("New password"), "replacement password");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "replacement password{Enter}");
    expect(screen.getByRole("button", { name: "Updating password..." })).toBeDisabled();
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/login");
    });
    expect(navigation.state.location.search).toBe("?passwordChanged=1");
  });

  it("shows reset-token errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "invalid_or_expired_token", message: "This link is invalid or has expired." },
    }, 400)));
    mountRoute("/reset-password?token=expired");
    await userEvent.type(screen.getByLabelText("New password"), "replacement password");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "replacement password{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
  });

  it("consumes a verification token in the route loader", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ verified: true })));
    mountRoute("/verify-email?token=verify-token&returnTo=%2Fleague");
    expect(await screen.findByRole("status")).toHaveTextContent("Email verified");
    expect(screen.queryByRole("textbox", { name: "Email" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" }))
      .toHaveAttribute("href", "/login?returnTo=%2Fleague");
  });

  it("keeps verification recovery available for an expired token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "invalid_or_expired_token", message: "This link is invalid or has expired." },
    }, 400)));
    mountRoute("/verify-email?token=expired&email=cam%40example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("cam@example.com");
  });

  it("requests a fresh verification link with its safe return path", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({
      accepted: true,
      message: "If this email is awaiting verification, a new link is on its way.",
    }, 202));
    vi.stubGlobal("fetch", fetcher);
    mountRoute("/verify-email?email=cam%40example.com&returnTo=%2Finvite%3Ftoken%3Dleague-token");
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "{Enter}");
    expect(await screen.findByRole("status")).toHaveTextContent("new link is on its way");
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      email: "cam@example.com",
      returnTo: "/invite?token=league-token",
    }));
  });

  it("opens a blank verification request when no context is supplied", async () => {
    mountRoute("/verify-email");
    expect(await screen.findByRole("textbox", { name: "Email" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Send verification link" })).toBeEnabled();
  });
});
