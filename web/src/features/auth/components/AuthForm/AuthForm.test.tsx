import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { authRoutes } from "../../routes/authRoutes";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";

const account = {
  createdAt: "2026-08-13T12:00:00.000Z",
  email: "cam@example.com",
  id: "account-cam",
  updatedAt: "2026-08-13T12:00:00.000Z",
};
const loginBody = {
  account,
  session: {
    accountId: account.id,
    createdAt: account.createdAt,
    expiresAt: "2026-09-13T12:00:00.000Z",
    id: "session-cam",
  },
  sessionToken: "session-token",
};
const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);
const Provider = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const mountRoute = (path: string) => {
  const router = createMemoryRouter([
    ...authRoutes,
    { path: "/practice", element: <h1>Practice</h1> },
    { path: "/league", element: <h1>League</h1> },
    { path: "/invite", element: <h1>Invitation</h1> },
  ], { initialEntries: [path] });
  render(<Provider><RouterProvider router={router} /></Provider>);
  return router;
};
const enterCredentials = async () => {
  await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "cam@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secure password");
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("AuthForm", () => {
  it("submits login on Enter and redirects only to a safe return path", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse(loginBody));
    vi.stubGlobal("fetch", fetcher);
    const navigation = mountRoute("/login?returnTo=%2Fleague%3FseasonId%3Dseason-1");
    await enterCredentials();
    await userEvent.type(screen.getByLabelText("Password"), "{Enter}");

    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/league");
    });
    expect(navigation.state.location.search).toBe("?seasonId=season-1");
    expect(fetcher).toHaveBeenCalledWith("/sessions", expect.objectContaining({ method: "POST" }));
  });

  it("uses Practice for an unsafe return path and exposes password-change context", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(loginBody)));
    const navigation = mountRoute("/login?passwordChanged=1&returnTo=https%3A%2F%2Fevil.example");
    expect(screen.getByRole("status")).toHaveTextContent("Password changed");
    await enterCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/practice");
    });
  });

  it("keeps server errors visible and offers unverified accounts a recovery path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: {
        code: "email_unverified",
        message: "Verify your email before signing in.",
      },
    }, 403)));
    mountRoute("/login?returnTo=%2Finvite%3Ftoken%3Dleague-token");
    await enterCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Verify your email");
    expect(screen.getByRole("link", { name: "Resend verification" }))
      .toHaveAttribute("href", expect.stringContaining("%2Finvite%3Ftoken%3Dleague-token"));
  });

  it("logs in after immediate signup and forwards the invitation token", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 25));
        return jsonResponse({ account }, 201);
      })
      .mockResolvedValueOnce(jsonResponse(loginBody));
    vi.stubGlobal("fetch", fetcher);
    const navigation = mountRoute("/signup?returnTo=%2Finvite%3Ftoken%3Dleague-token");
    await enterCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/invite");
    });

    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      email: "cam@example.com",
      invitationToken: "league-token",
      password: "secure password",
      returnTo: "/invite?token=league-token",
    }));
  });

  it("shows the privacy-preserving verification notice without logging in", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({
      accepted: true,
      message: "If this email can be registered, a verification link is on its way.",
    }, 202));
    vi.stubGlobal("fetch", fetcher);
    mountRoute("/signup");
    await enterCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent("verification link");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
